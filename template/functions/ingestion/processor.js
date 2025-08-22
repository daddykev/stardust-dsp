// functions/ingestion/processor.js
const admin = require("firebase-admin");
const { Storage } = require("@google-cloud/storage");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

// Add logger if not imported
const logger = {
  log: (...args) => console.log(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args)
};

const db = admin.firestore();
const storage = admin.storage();
const gcs = new Storage();

// Firebase Storage bucket
const STORAGE_BUCKET = "stardust-dsp.firebasestorage.app";

/**
 * Process releases with UPC-based deduplication and message type handling
 * Direct function - no longer Pub/Sub triggered
 */
async function processReleases(deliveryId, releases, deliveryData) {
  logger.log(`Processing ${releases.length} releases from delivery: ${deliveryId}`);
  
  const processedReleases = [];
  const messageType = deliveryData.ern?.messageType || 'NewRelease';
  
  try {
    for (const release of releases) {
      try {
        // Extract UPC as primary identifier
        let upc = null;
        if (release.RELEASEID?.ICPN) {
          let icpn = release.RELEASEID.ICPN;
          if (typeof icpn === 'object' && icpn._) {
            upc = icpn._;
          } else if (typeof icpn === 'string') {
            upc = icpn;
          }
        }
        
        // If no UPC, fall back to GRid
        const releaseIdentifier = upc || 
                                 release.ReleaseId?.GRid || 
                                 release.RELEASEID?.GRID || 
                                 release.ReleaseId?.GRID || 
                                 release.RELEASEID?.GRid;
        
        if (!releaseIdentifier) {
          logger.warn(`No UPC or GRid found for release, skipping`);
          continue;
        }
        
        logger.log(`Processing release with identifier: ${releaseIdentifier} (UPC: ${upc})`);
        logger.log(`Message type: ${messageType}`);
        
        // Use UPC as the document ID if available, otherwise use GRid
        const releaseId = upc ? `UPC_${upc}` : releaseIdentifier;
        
        // Check if release already exists
        const existingReleaseDoc = await db.collection("releases").doc(releaseId).get();
        const releaseExists = existingReleaseDoc.exists;
        
        // Handle different message types
        if (messageType === 'Takedown') {
          if (releaseExists) {
            // Mark release as taken down
            await db.collection("releases").doc(releaseId).update({
              status: "taken_down",
              "ingestion.takedownAt": admin.firestore.FieldValue.serverTimestamp(),
              "ingestion.takedownDeliveryId": deliveryId
            });
            
            logger.log(`Release ${releaseId} marked as taken down`);
            processedReleases.push({
              releaseId,
              title: existingReleaseDoc.data().metadata?.title || "Unknown",
              artist: existingReleaseDoc.data().metadata?.displayArtist || "Unknown",
              action: "takedown",
              trackCount: 0
            });
          } else {
            logger.warn(`Takedown requested for non-existent release: ${releaseId}`);
          }
          continue;
        }
        
        // Ensure we have required data
        const title = extractTitle(release);
        const artist = extractArtist(release);
        
        if (!title || title === "Unknown Title") {
          logger.warn(`Release ${releaseId} has no title, skipping`);
          continue;
        }
        
        // Process main release metadata
        const releaseDoc = {
          id: releaseId,
          upc: upc, // Store UPC at root level for easy querying
          messageId: release.ReleaseReference || release.RELEASEREFERENCE,
          sender: deliveryData.sender,
          
          metadata: {
            title: title,
            displayArtist: artist,
            label: extractLabel(release),
            releaseDate: parseReleaseDate(release),
            genre: extractGenres(release),
            copyright: extractCopyright(release),
            releaseType: release.ReleaseType || release.RELEASETYPE || "Album",
            totalTracks: 0, // Will update after processing tracks
            catalogNumber: release.CatalogNumber || release.CATALOGNUMBER || null,
            upc: upc
          },
          
          availability: {
            territories: extractTerritories(release),
            startDate: parseDate(release.GlobalReleaseDate || release.GLOBALRELEASEDATE),
            endDate: parseDate(release.GlobalEndDate || release.GLOBALENDDATE),
            tier: "all"
          },
          
          ingestion: {
            deliveryId,
            receivedAt: deliveryData.processing?.receivedAt || admin.firestore.FieldValue.serverTimestamp(),
            processedAt: admin.firestore.FieldValue.serverTimestamp(),
            ernVersion: deliveryData.ern?.version || "ERN-4.3",
            messageType: messageType,
            deliveryHistory: admin.firestore.FieldValue.arrayUnion(deliveryId)
          },
          
          stats: {
            playCount: 0,
            savedCount: 0
          },
          
          status: "processing"
        };
        
        // Process tracks with error handling
        let tracks = [];
        try {
          tracks = await processTracks(release, releaseId, deliveryData);
          releaseDoc.metadata.totalTracks = tracks.length;
        } catch (trackError) {
          logger.error(`Failed to process tracks for release ${releaseId}:`, trackError);
          tracks = [];
        }
        
        // Process artwork with error handling
        let artwork = { coverArt: null, additional: [] };
        try {
          artwork = await processArtwork(release, releaseId, deliveryData);
        } catch (artworkError) {
          logger.error(`Failed to process artwork for release ${releaseId}:`, artworkError);
        }
        
        // Handle update vs new release
        if (releaseExists && messageType === 'Update') {
          // Update existing release
          const existingData = existingReleaseDoc.data();
          
          // Merge with existing data, preserving stats and certain fields
          const updateData = {
            ...releaseDoc,
            stats: existingData.stats, // Preserve play counts
            "ingestion.updatedAt": admin.firestore.FieldValue.serverTimestamp(),
            "ingestion.updateCount": admin.firestore.FieldValue.increment(1),
            "ingestion.deliveryHistory": admin.firestore.FieldValue.arrayUnion(deliveryId),
            "ingestion.firstDeliveryId": existingData.ingestion?.firstDeliveryId || existingData.ingestion?.deliveryId
          };
          
          await db.collection("releases").doc(releaseId).update({
            ...updateData,
            assets: {
              coverArt: artwork.coverArt,
              additionalArt: artwork.additional || []
            },
            trackIds: tracks.map(t => t.id),
            status: "active",
            "metadata.totalTracks": tracks.length,
            "ingestion.completedAt": admin.firestore.FieldValue.serverTimestamp()
          });
          
          logger.log(`Release updated: ${releaseId} - ${title} by ${artist}`);
          
          processedReleases.push({
            releaseId,
            title: releaseDoc.metadata.title,
            artist: releaseDoc.metadata.displayArtist,
            trackCount: tracks.length,
            action: "update"
          });
          
        } else {
          // Create new release (or overwrite if duplicate NewRelease)
          if (releaseExists) {
            logger.warn(`Duplicate NewRelease message for UPC ${upc}, overwriting existing release`);
            
            // Preserve some fields from existing release
            const existingData = existingReleaseDoc.data();
            releaseDoc.stats = existingData.stats || releaseDoc.stats;
            releaseDoc.ingestion.firstDeliveryId = existingData.ingestion?.firstDeliveryId || deliveryId;
            releaseDoc.ingestion.deliveryHistory = [
              ...(existingData.ingestion?.deliveryHistory || []),
              deliveryId
            ];
          } else {
            releaseDoc.ingestion.firstDeliveryId = deliveryId;
          }
          
          // Store release
          await db.collection("releases").doc(releaseId).set(releaseDoc);
          logger.log(`Release document created/overwritten: ${releaseId}`);
          
          // Create or update artist profiles with error handling
          try {
            await processArtists(release, releaseId);
          } catch (artistError) {
            logger.error(`Failed to process artists for release ${releaseId}:`, artistError);
          }
          
          // Create album document with error handling
          try {
            await createAlbum(releaseDoc, tracks, artwork);
          } catch (albumError) {
            logger.error(`Failed to create album for release ${releaseId}:`, albumError);
          }
          
          // Update release with processed assets
          await db.collection("releases").doc(releaseId).update({
            assets: {
              coverArt: artwork.coverArt, // This should be a string URL, not an object
              additionalArt: artwork.additional || []
            },
            trackIds: tracks.map(t => t.id),
            status: "active",
            "metadata.totalTracks": tracks.length,
            "ingestion.completedAt": admin.firestore.FieldValue.serverTimestamp()
          });
          
          processedReleases.push({
            releaseId,
            title: releaseDoc.metadata.title,
            artist: releaseDoc.metadata.displayArtist,
            trackCount: tracks.length,
            action: releaseExists ? "overwrite" : "create"
          });
        }
        
        logger.log(`Release processed successfully: ${releaseId} - ${title} by ${artist}`);
        
      } catch (releaseError) {
        logger.error(`Failed to process individual release:`, releaseError);
        // Continue with next release
      }
    }
    
    if (processedReleases.length === 0) {
      throw new Error("No releases could be processed successfully");
    }
    
    // Create delivery history record
    await db.collection("deliveryHistory").doc(deliveryId).set({
      deliveryId: deliveryId,
      sender: deliveryData.sender,
      messageType: messageType,
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
      releases: processedReleases,
      ernVersion: deliveryData.ern?.version || "ERN-4.3"
    });
    
    return processedReleases;
    
  } catch (error) {
    logger.error("Release processing failed:", error);
    throw error;
  }
}

// Process individual tracks with UPC-based track IDs
async function processTracks(release, releaseId, deliveryData) {
  const tracks = [];
  
  // Handle uppercase keys from parser - check parsedData at root and nested levels
  const parsedData = deliveryData.parsedData || {};
  const resourceList = release.ResourceList || 
                      release.RESOURCELIST || 
                      parsedData.resourceList || 
                      parsedData.ResourceList ||
                      parsedData.RESOURCELIST || {};
  
  const soundRecordings = resourceList.SoundRecording || 
                         resourceList.soundRecording || 
                         resourceList.SOUNDRECORDING || [];
  
  const allSoundRecordings = Array.isArray(soundRecordings) ? soundRecordings : [soundRecordings];
  
  for (let index = 0; index < allSoundRecordings.length; index++) {
    const recording = allSoundRecordings[index];
    
    // Handle uppercase keys for ISRC
    const isrc = recording.SoundRecordingId?.ISRC || 
                recording.SOUNDRECORDINGID?.ISRC || 
                recording.ResourceId?.ISRC || 
                recording.RESOURCEID?.ISRC;
    
    // Use ISRC as primary track ID if available, otherwise use release_track pattern
    const trackId = isrc ? `ISRC_${isrc}` : `${releaseId}_TRACK_${index + 1}`;
    
    // Extract MD5 hash (handle uppercase)
    let md5Hash = null;
    const technicalDetails = recording.TechnicalDetails || 
                           recording.technicalDetails || 
                           recording.TECHNICALDETAILS || {};
    
    const file = technicalDetails.File || 
                technicalDetails.file || 
                technicalDetails.FILE || {};
    
    const hashSum = file.HashSum || 
                   file.hashSum || 
                   file.HASHSUM || {};
    
    if (hashSum) {
      const hashType = hashSum.HashSumAlgorithmType || 
                      hashSum.hashSumAlgorithmType || 
                      hashSum.HASHSUMALGORITHMTYPE;
      
      const hashValue = hashSum.HashSum || 
                       hashSum.hashSum || 
                       hashSum.HASHSUM;
      
      if (hashType === 'MD5' && hashValue) {
        md5Hash = hashValue;
      }
    }
    
    // Get audio file URL from transferred files if available
    let audioUrl = null;
    if (deliveryData.files?.transferred?.audio) {
      const audioFile = deliveryData.files.transferred.audio[index];
      if (audioFile) {
        audioUrl = audioFile.publicUrl;
      }
    }
    
    // Fallback to generating URL
    if (!audioUrl) {
      audioUrl = await getPublicUrl(`audio/original/${trackId}/audio.mp3`);
    }
    
    // Check if track already exists
    const existingTrackDoc = await db.collection("tracks").doc(trackId).get();
    
    const track = {
      id: trackId,
      releaseId,
      isrc: isrc || null,
      
      metadata: {
        title: extractTrackTitle(recording),
        displayArtist: extractRecordingArtist(recording) || extractArtist(release) || "Unknown Artist",
        duration: parseDuration(recording.Duration || recording.DURATION),
        trackNumber: recording.SequenceNumber || recording.SEQUENCENUMBER || index + 1,
        discNumber: recording.DiscNumber || recording.DISCNUMBER || 1,
        contributors: extractContributors(recording),
        genre: extractRecordingGenres(recording) || extractGenres(release),
        language: recording.LanguageOfPerformance || recording.LANGUAGEOFPERFORMANCE || null,
        explicit: (recording.ParentalWarningType || recording.PARENTALWARNINGTYPE) === "Explicit"
      },
      
      audio: {
        original: audioUrl,
        format: technicalDetails.AudioCodecType || technicalDetails.AUDIOCODECTYPE || "MP3",
        bitrate: technicalDetails.BitRate || technicalDetails.BITRATE || null,
        sampleRate: technicalDetails.SamplingRate || technicalDetails.SAMPLINGRATE || null,
        md5Hash: md5Hash,
        streams: {
          hls: `https://cdn.stardust-dsp.org/hls/${trackId}/master.m3u8`,
          dash: `https://cdn.stardust-dsp.org/dash/${trackId}/manifest.mpd`
        }
      },
      
      rights: {
        copyright: extractCopyright(recording),
        territories: extractTerritories(recording) || extractTerritories(release),
        startDate: parseDate(recording.StartDate || recording.STARTDATE),
        endDate: parseDate(recording.EndDate || recording.ENDDATE)
      },
      
      stats: {
        playCount: 0,
        skipCount: 0,
        completionRate: 0
      },
      
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    // Store or update track
    if (existingTrackDoc.exists) {
      // Preserve stats from existing track
      const existingData = existingTrackDoc.data();
      track.stats = existingData.stats || track.stats;
      await db.collection("tracks").doc(track.id).update(track);
    } else {
      await db.collection("tracks").doc(track.id).set(track);
    }
    
    tracks.push(track);
    
    logger.log(`Track processed: ${track.id} - ${track.metadata.title} by ${track.metadata.displayArtist}`);
  }
  
  return tracks;
}

// Process artwork
async function processArtwork(release, releaseId, deliveryData) {
  // Handle uppercase keys from parser - check parsedData at root and nested levels
  const parsedData = deliveryData.parsedData || {};
  const resourceList = release.ResourceList || 
                      release.RESOURCELIST || 
                      parsedData.resourceList || 
                      parsedData.ResourceList ||
                      parsedData.RESOURCELIST || {};
  
  const images = resourceList.Image || 
                resourceList.image || 
                resourceList.IMAGE || [];
  
  const allImages = Array.isArray(images) ? images : [images];
  
  const artwork = {
    coverArt: null,
    additional: []
  };
  
  for (let index = 0; index < allImages.length; index++) {
    const image = allImages[index];
    
    // Extract MD5 hash (handle uppercase)
    let md5Hash = null;
    const technicalDetails = image.TechnicalDetails || 
                           image.technicalDetails || 
                           image.TECHNICALDETAILS || {};
    
    const file = technicalDetails.File || 
                technicalDetails.file || 
                technicalDetails.FILE || {};
    
    const hashSum = file.HashSum || 
                   file.hashSum || 
                   file.HASHSUM || {};
    
    if (hashSum) {
      const hashType = hashSum.HashSumAlgorithmType || 
                      hashSum.hashSumAlgorithmType || 
                      hashSum.HASHSUMALGORITHMTYPE;
      
      const hashValue = hashSum.HashSum || 
                       hashSum.hashSum || 
                       hashSum.HASHSUM;
      
      if (hashType === 'MD5' && hashValue) {
        md5Hash = hashValue;
      }
    }
    
    // Get image file URL from transferred files if available
    let imageUrl = null;
    if (deliveryData.files?.transferred?.images) {
      const imageFile = deliveryData.files.transferred.images[index];
      if (imageFile) {
        imageUrl = imageFile.publicUrl;
      }
    }
    
    // Fallback to generating URL
    if (!imageUrl) {
      const imageType = image.ImageType || image.IMAGETYPE || 'cover';
      imageUrl = await getPublicUrl(`images/artwork/${releaseId}/${imageType}.jpg`);
    }
    
    const imageDoc = {
      type: image.ImageType || image.IMAGETYPE || 'Unknown',
      url: imageUrl,
      width: technicalDetails.ImageWidth || technicalDetails.IMAGEWIDTH || null,
      height: technicalDetails.ImageHeight || technicalDetails.IMAGEHEIGHT || null,
      format: technicalDetails.ImageCodecType || technicalDetails.IMAGECODECTYPE || "JPEG",
      md5Hash: md5Hash
    };
    
    const imageType = image.ImageType || image.IMAGETYPE || '';
    if (imageType === "FrontCoverImage" || 
        imageType === "FRONTCOVERIMAGE" || 
        (!artwork.coverArt && imageType.toUpperCase().includes("COVER"))) {
      // Store just the URL string, not an object
      artwork.coverArt = imageUrl; // Just the string URL
      // Remove the sizes generation for now, or store separately
    } else {
      artwork.additional.push(imageDoc);
    }
  }
  
  // If no cover art found, create placeholder
  if (!artwork.coverArt) {
    const placeholderUrl = await getPublicUrl("images/placeholder.jpg");
    artwork.coverArt = {
      type: "FrontCoverImage",
      url: placeholderUrl,
      md5Hash: null,
      sizes: {
        small: await getPublicUrl("images/placeholder-small.jpg"),
        medium: await getPublicUrl("images/placeholder-medium.jpg"),
        large: await getPublicUrl("images/placeholder-large.jpg")
      }
    };
  }
  
  return artwork;
}

// Create album document for catalog browsing
async function createAlbum(releaseDoc, tracks, artwork) {
  const albumId = releaseDoc.id;
  
  const albumDoc = {
    id: albumId,
    releaseId: releaseDoc.id,
    
    metadata: {
      title: releaseDoc.metadata.title,
      displayArtist: releaseDoc.metadata.displayArtist,
      type: releaseDoc.metadata.releaseType || 'Album',
      releaseDate: releaseDoc.metadata.releaseDate,
      label: releaseDoc.metadata.label,
      upc: releaseDoc.metadata.upc,
      genre: releaseDoc.metadata.genre
    },
    
    artwork: {
      cover: artwork.coverArt,
      additional: artwork.additional,
      palette: null
    },
    
    trackIds: tracks.map(t => t.id),
    trackCount: tracks.length,
    totalDuration: tracks.reduce((sum, t) => sum + (t.metadata.duration || 0), 0),
    
    stats: {
      playCount: 0,
      savedCount: 0
    },
    
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
  
  await db.collection("albums").doc(albumId).set(albumDoc);
  logger.log(`Album created: ${albumId} - ${albumDoc.metadata.title}`);
  
  return albumDoc;
}

// Process and create/update artist profiles with deduplication
async function processArtists(release, releaseId) {
  const artists = new Set();
  
  // Get main artist
  const mainArtist = extractArtist(release);
  if (mainArtist && mainArtist !== "Unknown Artist") {
    artists.add(mainArtist);
  }
  
  // Get track artists (handle uppercase)
  const resourceList = release.ResourceList || 
                      release.RESOURCELIST || {};
  
  const soundRecordings = resourceList.SoundRecording || 
                         resourceList.soundRecording || 
                         resourceList.SOUNDRECORDING || [];
  
  const allSoundRecordings = Array.isArray(soundRecordings) ? soundRecordings : [soundRecordings];
  
  for (const recording of allSoundRecordings) {
    const trackArtist = extractRecordingArtist(recording);
    if (trackArtist && trackArtist !== "Unknown Artist") {
      artists.add(trackArtist);
    }
  }
  
  // Create/update artist documents
  for (const artistName of artists) {
    const artistId = generateArtistId(artistName);
    
    const artistRef = db.collection("artists").doc(artistId);
    const artistDoc = await artistRef.get();
    
    if (artistDoc.exists) {
      // Update existing artist - use arrayUnion to prevent duplicates
      await artistRef.update({
        releases: admin.firestore.FieldValue.arrayUnion(releaseId),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } else {
      // Create new artist
      await artistRef.set({
        id: artistId,
        name: artistName,
        sortName: artistName.toLowerCase(),
        releases: [releaseId],
        profile: {
          bio: null,
          image: null,
          country: null,
          genres: extractGenres(release),
          founded: null
        },
        stats: {
          releaseCount: 1,
          trackCount: 0,
          monthlyListeners: 0,
          followers: 0
        },
        verified: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    
    logger.log(`Artist processed: ${artistId} - ${artistName}`);
  }
}

// Helper functions

// Generate public URL for Firebase Storage
async function getPublicUrl(filePath) {
  const encodedPath = encodeURIComponent(filePath);
  return `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${encodedPath}?alt=media`;
}

function generateImageSizeUrls(originalUrl, releaseId) {
  const basePath = originalUrl.split('?')[0];
  const baseStoragePath = basePath.replace(
    `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/`,
    ''
  );
  const decodedPath = decodeURIComponent(baseStoragePath);
  const pathWithoutExt = decodedPath.replace(/\.[^.]+$/, "");
  
  return {
    small: `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${encodeURIComponent(pathWithoutExt + "-small.jpg")}?alt=media`,
    medium: `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${encodeURIComponent(pathWithoutExt + "-medium.jpg")}?alt=media`,
    large: `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${encodeURIComponent(pathWithoutExt + "-large.jpg")}?alt=media`
  };
}

function generateReleaseId() {
  return `GR${uuidv4().replace(/-/g, "").substring(0, 12).toUpperCase()}`;
}

function generateArtistId(artistName) {
  return artistName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 50);
}

function extractTitle(release) {
  // Handle uppercase keys from parser
  if (release.DisplayTitleText || release.displaytitletext || release.DISPLAYTITLETEXT) {
    return release.DisplayTitleText || release.displaytitletext || release.DISPLAYTITLETEXT;
  }
  
  // Check ReferenceTitle with uppercase handling
  const referenceTitle = release.ReferenceTitle || release.REFERENCETITLE;
  if (referenceTitle) {
    return referenceTitle.TitleText || referenceTitle.TITLETEXT || referenceTitle.titletext;
  }
  
  // ERN 3.x: Check ReleaseDetailsByTerritory
  const releaseDetails = release.ReleaseDetailsByTerritory || release.RELEASEDETAILSBYTERRITORY;
  if (releaseDetails?.[0]) {
    const title = releaseDetails[0].Title || releaseDetails[0].TITLE;
    if (title) {
      return title.TitleText || title.TITLETEXT || title.titletext;
    }
  }
  
  return "Unknown Title";
}

function extractTrackTitle(recording) {
  // Handle uppercase keys for track title
  if (recording.DisplayTitleText || recording.DISPLAYTITLETEXT) {
    return recording.DisplayTitleText || recording.DISPLAYTITLETEXT;
  }
  
  const referenceTitle = recording.ReferenceTitle || recording.REFERENCETITLE;
  if (referenceTitle) {
    return referenceTitle.TitleText || referenceTitle.TITLETEXT || referenceTitle.titletext;
  }
  
  const title = recording.Title || recording.TITLE;
  if (title) {
    return title.TitleText || title.TITLETEXT || title.titletext;
  }
  
  return `Track ${recording.SequenceNumber || recording.SEQUENCENUMBER || ''}`;
}

function extractArtist(release) {
  // Handle uppercase variations from parser
  const displayArtist = release.DisplayArtist || 
                        release.displayArtist || 
                        release.DISPLAYARTIST;
  
  if (displayArtist) {
    const partyName = displayArtist.PartyName || 
                     displayArtist.partyName || 
                     displayArtist.PARTYNAME ||
                     displayArtist.partyname;
    
    if (partyName) {
      const fullName = partyName.FullName || 
                      partyName.fullName || 
                      partyName.FULLNAME ||
                      partyName.fullname;
      if (fullName) return fullName;
    }
    
    if (displayArtist.Name || displayArtist.name || displayArtist.NAME) {
      return displayArtist.Name || displayArtist.name || displayArtist.NAME;
    }
  }
  
  // ERN 3.x: Check ReleaseDetailsByTerritory
  const releaseDetails = release.ReleaseDetailsByTerritory || 
                        release.releaseDetailsByTerritory || 
                        release.RELEASEDETAILSBYTERRITORY;
  
  if (releaseDetails?.[0]) {
    const firstTerritory = releaseDetails[0];
    const displayArtist = firstTerritory.DisplayArtist || 
                         firstTerritory.displayArtist || 
                         firstTerritory.DISPLAYARTIST;
    
    if (displayArtist) {
      const partyName = displayArtist.PartyName || displayArtist.PARTYNAME;
      const fullName = partyName?.FullName || partyName?.FULLNAME;
      if (fullName) return fullName;
      
      if (displayArtist.Name || displayArtist.NAME) {
        return displayArtist.Name || displayArtist.NAME;
      }
    }
  }
  
  return "Unknown Artist";
}

function extractRecordingArtist(recording) {
  // Handle uppercase variations from parser
  const displayArtist = recording.DisplayArtist || 
                        recording.displayArtist || 
                        recording.DISPLAYARTIST;
  
  if (displayArtist) {
    // Handle nested PartyName structure with all case variations
    const partyName = displayArtist.PartyName || 
                     displayArtist.partyName || 
                     displayArtist.PARTYNAME ||
                     displayArtist.partyname;
    
    if (partyName) {
      const fullName = partyName.FullName || 
                      partyName.fullName || 
                      partyName.FULLNAME ||
                      partyName.fullname;
      if (fullName) return fullName;
    }
    
    // Direct name properties
    if (displayArtist.Name || displayArtist.name || displayArtist.NAME) {
      return displayArtist.Name || displayArtist.name || displayArtist.NAME;
    }
    
    // If DisplayArtist is a string
    if (typeof displayArtist === 'string') {
      return displayArtist;
    }
  }
  
  // Fallback to Contributor
  const contributor = recording.Contributor || 
                     recording.contributor || 
                     recording.CONTRIBUTOR;
  
  if (contributor) {
    const contributors = Array.isArray(contributor) ? contributor : [contributor];
    const mainContributor = contributors.find(c => 
      c.Role === 'MainArtist' || c.ROLE === 'MainArtist' || c.role === 'MainArtist'
    ) || contributors[0];
    
    if (mainContributor) {
      const partyName = mainContributor.PartyName || 
                       mainContributor.partyName || 
                       mainContributor.PARTYNAME;
      
      if (partyName) {
        const fullName = partyName.FullName || 
                        partyName.fullName || 
                        partyName.FULLNAME;
        if (fullName) return fullName;
      }
    }
  }
  
  return null;
}

function extractLabel(release) {
  // Handle uppercase keys
  const labelName = release.LabelName || 
                   release.labelname || 
                   release.LABELNAME;
  
  if (labelName) {
    return Array.isArray(labelName) ? labelName[0] : labelName;
  }
  
  // ERN 3.x: Check ReleaseDetailsByTerritory
  const releaseDetails = release.ReleaseDetailsByTerritory || release.RELEASEDETAILSBYTERRITORY;
  if (releaseDetails?.[0]) {
    const labelName = releaseDetails[0].LabelName || releaseDetails[0].LABELNAME;
    return Array.isArray(labelName) ? labelName[0] : labelName;
  }
  
  return "Independent";
}

function extractGenres(release) {
  let genres = [];
  
  // Handle uppercase keys
  genres = release.Genre || release.genre || release.GENRE;
  
  // ERN 3.x: Check ReleaseDetailsByTerritory
  if (!genres) {
    const releaseDetails = release.ReleaseDetailsByTerritory || release.RELEASEDETAILSBYTERRITORY;
    if (releaseDetails?.[0]) {
      genres = releaseDetails[0].Genre || releaseDetails[0].GENRE;
    }
  }
  
  // Return empty array if no genres found
  if (!genres) {
    return [];
  }
  
  const genreList = Array.isArray(genres) ? genres : [genres];
  
  // Filter out undefined/null values and safely extract genre text
  return genreList
    .filter(g => g != null) // Filter out null and undefined
    .map(g => {
      if (typeof g === 'string') return g;
      if (g && typeof g === 'object') {
        return g.GenreText || g.genretext || g.GENRETEXT || null;
      }
      return null;
    })
    .filter(Boolean); // Remove any null values
}

function extractRecordingGenres(recording) {
  const genres = recording.Genre || recording.GENRE || [];
  
  if (!genres) {
    return [];
  }
  
  const genreList = Array.isArray(genres) ? genres : [genres];
  
  // Filter out undefined/null values and safely extract genre text
  return genreList
    .filter(g => g != null) // Filter out null and undefined
    .map(g => {
      if (typeof g === 'string') return g;
      if (g && typeof g === 'object') {
        return g.GenreText || g.GENRETEXT || g.genretext || null;
      }
      return null;
    })
    .filter(Boolean); // Remove any null values
}

function extractCopyright(item) {
  const copyrights = [];
  
  // Handle uppercase keys for CLine
  const clines = item.CLine || item.cline || item.CLINE || [];
  const clineArray = Array.isArray(clines) ? clines : [clines];
  
  clineArray.forEach(c => {
    if (c) {
      copyrights.push({
        type: "C",
        text: c.CLineText || c.clinetext || c.CLINETEXT || c,
        year: c.Year || c.year || c.YEAR || null
      });
    }
  });
  
  // Handle uppercase keys for PLine
  const plines = item.PLine || item.pline || item.PLINE || [];
  const plineArray = Array.isArray(plines) ? plines : [plines];
  
  plineArray.forEach(p => {
    if (p) {
      copyrights.push({
        type: "P",
        text: p.PLineText || p.plinetext || p.PLINETEXT || p,
        year: p.Year || p.year || p.YEAR || null
      });
    }
  });
  
  return copyrights;
}

function extractTerritories(item) {
  if (!item) return ["Worldwide"];
  
  // Handle uppercase keys
  const releaseDetails = item.ReleaseDetailsByTerritory || item.RELEASEDETAILSBYTERRITORY;
  const territories = releaseDetails?.map(d => d.TerritoryCode || d.TERRITORYCODE) || 
                     item.TerritoryCode || 
                     item.TERRITORYCODE || 
                     [];
  
  const territoryList = Array.isArray(territories) ? territories : [territories];
  return territoryList.length > 0 ? territoryList : ["Worldwide"];
}

function extractContributors(recording) {
  const contributors = [];
  
  // Handle uppercase keys
  const contributor = recording.Contributor || recording.CONTRIBUTOR;
  
  if (contributor) {
    const contribList = Array.isArray(contributor) ? contributor : [contributor];
    contributors.push(...contribList.map(c => ({
      name: c.PartyName?.FullName || c.PARTYNAME?.FULLNAME || c.Name || c.NAME,
      role: c.Role || c.ROLE || "Performer"
    })));
  }
  
  return contributors;
}

function parseReleaseDate(release) {
  // Handle uppercase keys
  const dateStr = release.OriginalReleaseDate || 
                  release.originalreleasedate ||
                  release.ORIGINALRELEASEDATE ||
                  release.ReleaseDate || 
                  release.releasedate ||
                  release.RELEASEDATE ||
                  release.GlobalOriginalReleaseDate || 
                  release.GLOBALORIGINALRELEASEDATE ||
                  release.GlobalReleaseDate || 
                  release.GLOBALRELEASEDATE ||
                  release.ReleaseDetailsByTerritory?.[0]?.ReleaseDate ||
                  release.RELEASEDETAILSBYTERRITORY?.[0]?.RELEASEDATE ||
                  new Date().toISOString();
  
  try {
    return admin.firestore.Timestamp.fromDate(new Date(dateStr));
  } catch (error) {
    logger.warn(`Invalid date format: ${dateStr}`);
    return admin.firestore.Timestamp.now();
  }
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  
  try {
    return admin.firestore.Timestamp.fromDate(new Date(dateStr));
  } catch (error) {
    logger.warn(`Invalid date format: ${dateStr}`);
    return null;
  }
}

function parseDuration(duration) {
  if (!duration) return 0;
  
  // ISO 8601 duration (PT3M45S)
  const isoMatch = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/);
  if (isoMatch) {
    const hours = parseInt(isoMatch[1] || "0");
    const minutes = parseInt(isoMatch[2] || "0");
    const seconds = parseFloat(isoMatch[3] || "0");
    return Math.round(hours * 3600 + minutes * 60 + seconds);
  }
  
  // HH:MM:SS format
  const timeMatch = duration.match(/(\d+):(\d+):(\d+)/);
  if (timeMatch) {
    const hours = parseInt(timeMatch[1]);
    const minutes = parseInt(timeMatch[2]);
    const seconds = parseInt(timeMatch[3]);
    return hours * 3600 + minutes * 60 + seconds;
  }
  
  // MM:SS format
  const shortMatch = duration.match(/(\d+):(\d+)/);
  if (shortMatch) {
    const minutes = parseInt(shortMatch[1]);
    const seconds = parseInt(shortMatch[2]);
    return minutes * 60 + seconds;
  }
  
  // Just seconds
  const secondsOnly = parseInt(duration);
  if (!isNaN(secondsOnly)) {
    return secondsOnly;
  }
  
  logger.warn(`Unknown duration format: ${duration}`);
  return 0;
}

// Export the direct function
module.exports = { processReleases };