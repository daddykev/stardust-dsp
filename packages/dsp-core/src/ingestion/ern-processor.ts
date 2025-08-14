import { parseStringPromise } from 'xml2js';
import { z } from 'zod';
import { db, storage } from '../firebase';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// ERN Schema validation
const ERNReleaseSchema = z.object({
  messageHeader: z.object({
    messageId: z.string(),
    messageCreatedDateTime: z.string(),
    messageSender: z.object({
      partyId: z.string(),
      partyName: z.string()
    })
  }),
  release: z.array(z.object({
    releaseId: z.string(),
    releaseReference: z.string(),
    releaseDetails: z.object({
      title: z.string(),
      artistName: z.string(),
      labelName: z.string(),
      releaseDate: z.string(),
      genre: z.array(z.string()).optional()
    }),
    soundRecording: z.array(z.object({
      isrc: z.string(),
      title: z.string(),
      duration: z.string(),
      artistName: z.string(),
      audioFile: z.string()
    }))
  }))
});

export class ERNProcessor {
  private workbenchAPI: string;
  
  constructor(workbenchAPIUrl?: string) {
    this.workbenchAPI = workbenchAPIUrl || process.env.VITE_WORKBENCH_API || 'https://api.ddex-workbench.org';
  }
  
  /**
   * Process an ERN delivery package
   */
  async processDelivery(deliveryPath: string, senderId: string) {
    try {
      // 1. Extract and parse manifest.xml
      const manifest = await this.extractManifest(deliveryPath);
      const ernData = await this.parseERN(manifest);
      
      // 2. Validate via DDEX Workbench
      const validation = await this.validateERN(manifest);
      if (!validation.valid) {
        throw new Error(`ERN validation failed: ${validation.errors.join(', ')}`);
      }
      
      // 3. Process release data
      const releases = await this.processReleases(ernData, deliveryPath);
      
      // 4. Store in Firestore
      await this.storeReleases(releases, senderId);
      
      // 5. Generate acknowledgment
      const acknowledgment = await this.generateAcknowledgment(
        ernData.messageHeader.messageId,
        releases
      );
      
      return {
        success: true,
        messageId: ernData.messageHeader.messageId,
        releaseCount: releases.length,
        acknowledgment
      };
      
    } catch (error) {
      console.error('ERN processing failed:', error);
      throw error;
    }
  }
  
  /**
   * Extract manifest.xml from delivery package
   */
  private async extractManifest(deliveryPath: string): Promise<string> {
    // Read manifest.xml from the delivery package
    const manifestPath = `${deliveryPath}/manifest.xml`;
    // In production, this would read from Cloud Storage
    const response = await fetch(manifestPath);
    return response.text();
  }
  
  /**
   * Parse ERN XML to JavaScript object
   */
  private async parseERN(xmlContent: string) {
    const parsed = await parseStringPromise(xmlContent, {
      explicitArray: false,
      ignoreAttrs: false
    });
    
    // Validate against schema
    return ERNReleaseSchema.parse(parsed);
  }
  
  /**
   * Validate ERN via DDEX Workbench API
   */
  private async validateERN(xmlContent: string) {
    const response = await fetch(`${this.workbenchAPI}/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml',
        'Authorization': `Bearer ${process.env.WORKBENCH_API_KEY}`
      },
      body: xmlContent
    });
    
    return response.json();
  }
  
  /**
   * Process releases and their assets
   */
  private async processReleases(ernData: any, deliveryPath: string) {
    const releases = [];
    
    for (const release of ernData.release) {
      // Process audio files
      const tracks = await Promise.all(
        release.soundRecording.map(async (recording: any) => {
          // Upload audio to storage
          const audioUrl = await this.uploadAudio(
            `${deliveryPath}/${recording.audioFile}`,
            recording.isrc
          );
          
          return {
            isrc: recording.isrc,
            title: recording.title,
            duration: this.parseDuration(recording.duration),
            artistName: recording.artistName,
            audioUrl,
            streamingUrls: await this.generateStreamingUrls(audioUrl, recording.isrc)
          };
        })
      );
      
      // Process artwork
      const artworkUrl = await this.uploadArtwork(
        `${deliveryPath}/${release.coverArt}`,
        release.releaseId
      );
      
      releases.push({
        releaseId: release.releaseId,
        releaseReference: release.releaseReference,
        title: release.releaseDetails.title,
        artistName: release.releaseDetails.artistName,
        labelName: release.releaseDetails.labelName,
        releaseDate: new Date(release.releaseDetails.releaseDate),
        genre: release.releaseDetails.genre || [],
        artworkUrl,
        tracks,
        status: 'active'
      });
    }
    
    return releases;
  }
  
  /**
   * Upload audio file to storage
   */
  private async uploadAudio(filePath: string, isrc: string): Promise<string> {
    const audioRef = ref(storage, `audio/original/${isrc}.mp3`);
    // In production, this would read the actual file
    const audioBlob = new Blob([], { type: 'audio/mpeg' });
    await uploadBytes(audioRef, audioBlob);
    return getDownloadURL(audioRef);
  }
  
  /**
   * Upload artwork to storage
   */
  private async uploadArtwork(filePath: string, releaseId: string): Promise<string> {
    const artworkRef = ref(storage, `images/artwork/${releaseId}.jpg`);
    // In production, this would read the actual file
    const imageBlob = new Blob([], { type: 'image/jpeg' });
    await uploadBytes(artworkRef, imageBlob);
    return getDownloadURL(artworkRef);
  }
  
  /**
   * Generate streaming URLs (HLS/DASH)
   */
  private async generateStreamingUrls(audioUrl: string, isrc: string) {
    // In production, this would trigger transcoding
    return {
      hls: `https://cdn.stardust-dsp.org/hls/${isrc}/master.m3u8`,
      dash: `https://cdn.stardust-dsp.org/dash/${isrc}/manifest.mpd`,
      download: {
        high: audioUrl,
        medium: `https://cdn.stardust-dsp.org/audio/128/${isrc}.mp3`
      }
    };
  }
  
  /**
   * Store releases in Firestore
   */
  private async storeReleases(releases: any[], senderId: string) {
    const batch = [];
    
    for (const release of releases) {
      // Store release
      const releaseRef = doc(collection(db, 'releases'), release.releaseId);
      batch.push(setDoc(releaseRef, {
        ...release,
        senderId,
        ingestedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }));
      
      // Store individual tracks
      for (const track of release.tracks) {
        const trackRef = doc(collection(db, 'tracks'), track.isrc);
        batch.push(setDoc(trackRef, {
          ...track,
          releaseId: release.releaseId,
          senderId,
          createdAt: serverTimestamp()
        }));
      }
      
      // Create/update artist profile
      const artistRef = doc(collection(db, 'artists'), this.slugify(release.artistName));
      batch.push(setDoc(artistRef, {
        name: release.artistName,
        releases: [release.releaseId],
        updatedAt: serverTimestamp()
      }, { merge: true }));
    }
    
    await Promise.all(batch);
  }
  
  /**
   * Generate DDEX acknowledgment message
   */
  private async generateAcknowledgment(messageId: string, releases: any[]) {
    const ackMessage = {
      messageHeader: {
        messageId: `ACK-${messageId}`,
        messageCreatedDateTime: new Date().toISOString(),
        messageRecipient: {
          partyId: 'STARDUST_DSP',
          partyName: 'Stardust DSP'
        }
      },
      acknowledgmentStatus: 'Acknowledged',
      processedReleases: releases.map(r => ({
        releaseId: r.releaseId,
        status: 'Success',
        processingTime: new Date().toISOString()
      }))
    };
    
    return ackMessage;
  }
  
  /**
   * Parse ISO duration to seconds
   */
  private parseDuration(isoDuration: string): number {
    // Parse PT3M45S format to seconds
    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    
    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    const seconds = parseInt(match[3] || '0');
    
    return hours * 3600 + minutes * 60 + seconds;
  }
  
  /**
   * Create URL-safe slug from text
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}