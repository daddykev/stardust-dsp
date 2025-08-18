// functions/ingestion/processor.js
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");
const { Storage } = require("@google-cloud/storage");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const db = admin.firestore();
const storage = admin.storage();
const gcs = new Storage();

// Firebase Storage bucket
const STORAGE_BUCKET = "stardust-dsp.firebasestorage.app";

/**
 * Process releases and their assets
 * Direct function - no longer Pub/Sub triggered
 */
async function processReleases(deliveryId, releases, deliveryData) {
  logger.log(`Processing ${releases.length} releases from delivery: ${deliveryId}`);
  
  const processedReleases = [];
  
  try {
    for (const release of releases) {
      const releaseId = release.ReleaseId?.GRid || generateReleaseId();
      
      logger.log(`Processing release: ${releaseId}`);
      
      // Process main release metadata
      const releaseDoc = {
        id: releaseId,
        messageId: release.ReleaseReference,
        sender: deliveryData.sender,
        
        metadata: {
          title: extractTitle(release),
          displayArtist: extractArtist(release),
          label: extractLabel(release),
          releaseDate: parseReleaseDate(release),
          genre: extractGenres(release),
          copyright: extractCopyright(release),
          releaseType: release.ReleaseType || "Album",
          totalTracks: release.ReleaseResourceReferenceList?.length || 0,
          catalogNumber: release.CatalogNumber || null,
          upc: release.ReleaseId?.ICPN || null
        },
        
        availability: {
          territories: extractTerritories(release),
          startDate: parseDate(release.GlobalReleaseDate),
          endDate: parseDate(release.GlobalEndDate),
          tier: "all"
        },
        
        ingestion: {
          deliveryId,
          receivedAt: deliveryData.processing?.receivedAt || admin.firestore.FieldValue.serverTimestamp(),
          processedAt: admin.firestore.FieldValue.serverTimestamp(),
          ernVersion: deliveryData.ern?.version || "ERN-3.8.2"
        },
        
        stats: {
          playCount: 0,
          savedCount: 0
        },
        
        status: "processing"
      };
      
      // Store release
      await db.collection("releases").doc(releaseId).set(releaseDoc);
      
      // Process tracks
      const tracks = await processTracks(release, releaseId, deliveryData);
      
      // Process artwork
      const artwork = await processArtwork(release, releaseId, deliveryData);
      
      // Create or update artist profiles
      await processArtists(release, releaseId);
      
      // Create album document
      await createAlbum(releaseDoc, tracks, artwork);
      
      // Update release with processed assets
      await db.collection("releases").doc(releaseId).update({
        assets: {
          coverArt: artwork.coverArt,
          additionalArt: artwork.additional || []
        },
        trackIds: tracks.map(t => t.id),
        status: "active",
        "ingestion.completedAt": admin.firestore.FieldValue.serverTimestamp()
      });
      
      processedReleases.push({
        releaseId,
        title: releaseDoc.metadata.title,
        artist: releaseDoc.metadata.displayArtist,
        trackCount: tracks.length
      });
      
      logger.log(`Release processed successfully: ${releaseId}`);
    }
    
    return processedReleases;
    
  } catch (error) {
    logger.error("Release processing failed:", error);
    throw error;
  }
}

// Process individual tracks
async function processTracks(release, releaseId, deliveryData) {
  const tracks = [];
  const soundRecordings = release.ResourceList?.SoundRecording || release.ResourceList?.soundRecording || [];
  
  // If ResourceList is at root level, use it
  const resourceList = release.ResourceList || deliveryData.parsedData?.resourceList || {};
  const allSoundRecordings = resourceList.SoundRecording || resourceList.soundRecording || soundRecordings;
  
  for (let index = 0; index < allSoundRecordings.length; index++) {
    const recording = allSoundRecordings[index];
    const trackId = recording.SoundRecordingId?.ISRC || `${releaseId}_TRACK_${index + 1}`;
    
    // Extract MD5 hash
    let md5Hash = null;
    const technicalDetails = recording.TechnicalDetails || recording.technicalDetails;
    if (technicalDetails?.File?.HashSum) {
      const hashSum = technicalDetails.File.HashSum;
      if (hashSum.HashSumAlgorithmType === 'MD5' && hashSum.HashSum) {
        md5Hash = hashSum.HashSum;
      }
    }
    
    // Get audio file URL from transferred files if available
    let audioUrl = null;
    if (deliveryData.files?.transferred?.audio) {
      // Try to match by index or filename
      const audioFile = deliveryData.files.transferred.audio[index];
      if (audioFile) {
        audioUrl = audioFile.publicUrl;
      }
    }
    
    // Fallback to generating URL
    if (!audioUrl) {
      audioUrl = await getPublicUrl(`audio/original/${trackId}/audio.mp3`);
    }
    
    const track = {
      id: trackId,
      releaseId,
      isrc: recording.SoundRecordingId?.ISRC || null,
      
      metadata: {
        title: recording.ReferenceTitle?.TitleText || recording.Title?.TitleText || 
               recording.DisplayTitleText || recording.displaytitletext || `Track ${index + 1}`,
        displayArtist: extractRecordingArtist(recording) || extractArtist(release) || "Unknown Artist",
        duration: parseDuration(recording.Duration),
        trackNumber: recording.SequenceNumber || index + 1,
        discNumber: recording.DiscNumber || 1,
        contributors: extractContributors(recording),
        genre: extractRecordingGenres(recording) || extractGenres(release),
        language: recording.LanguageOfPerformance || recording.Language || null,
        explicit: recording.ParentalWarningType === "Explicit"
      },
      
      audio: {
        original: audioUrl,
        format: recording.TechnicalDetails?.AudioCodecType || recording.TechnicalDetails?.AudioCodec || "MP3",
        bitrate: recording.TechnicalDetails?.BitRate || null,
        sampleRate: recording.TechnicalDetails?.SamplingRate || null,
        md5Hash: md5Hash, // Store MD5 hash
        streams: {
          hls: `https://cdn.stardust-dsp.org/hls/${trackId}/master.m3u8`,
          dash: `https://cdn.stardust-dsp.org/dash/${trackId}/manifest.mpd`
        }
      },
      
      rights: {
        copyright: extractCopyright(recording),
        territories: extractTerritories(recording) || extractTerritories(release),
        startDate: parseDate(recording.StartDate),
        endDate: parseDate(recording.EndDate)
      },
      
      stats: {
        playCount: 0,
        skipCount: 0,
        completionRate: 0
      },
      
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    // Store track
    await db.collection("tracks").doc(track.id).set(track);
    tracks.push(track);
    
    logger.log(`Track processed: ${track.id} - ${track.metadata.title} by ${track.metadata.displayArtist}`);
  }
  
  return tracks;
}

// Process artwork
async function processArtwork(release, releaseId, deliveryData) {
  const images = release.ResourceList?.Image || release.ResourceList?.image || [];
  const resourceList = release.ResourceList || deliveryData.parsedData?.resourceList || {};
  const allImages = resourceList.Image || resourceList.image || images;
  
  const artwork = {
    coverArt: null,
    additional: []
  };
  
  for (let index = 0; index < allImages.length; index++) {
    const image = allImages[index];
    
    // Extract MD5 hash
    let md5Hash = null;
    const technicalDetails = image.TechnicalDetails || image.technicalDetails;
    if (technicalDetails?.File?.HashSum) {
      const hashSum = technicalDetails.File.HashSum;
      if (hashSum.HashSumAlgorithmType === 'MD5' && hashSum.HashSum) {
        md5Hash = hashSum.HashSum;
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
      const imageType = image.ImageType || 'cover';
      imageUrl = await getPublicUrl(`images/artwork/${releaseId}/${imageType}.jpg`);
    }
    
    const imageDoc = {
      type: image.ImageType || 'Unknown',
      url: imageUrl,
      width: image.TechnicalDetails?.ImageWidth || image.TechnicalDetails?.Width || null,
      height: image.TechnicalDetails?.ImageHeight || image.TechnicalDetails?.Height || null,
      format: image.TechnicalDetails?.ImageCodecType || image.TechnicalDetails?.ImageCodec || "JPEG",
      md5Hash: md5Hash // Store MD5 hash
    };
    
    if (image.ImageType === "FrontCoverImage" || (!artwork.coverArt && image.ImageType?.includes("Cover"))) {
      artwork.coverArt = {
        ...imageDoc,
        sizes: generateImageSizeUrls(imageUrl, releaseId)
      };
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
      md5Hash: null, // No hash for placeholder
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
      palette: null // Could extract colors here
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

// Process and create/update artist profiles
async function processArtists(release, releaseId) {
  const artists = new Set();
  
  // Get main artist
  const mainArtist = extractArtist(release);
  if (mainArtist && mainArtist !== "Unknown Artist") {
    artists.add(mainArtist);
  }
  
  // Get track artists
  const soundRecordings = release.ResourceList?.SoundRecording || [];
  for (const recording of soundRecordings) {
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
      // Update existing artist
      await artistRef.update({
        releases: admin.firestore.FieldValue.arrayUnion(releaseId),
        "stats.releaseCount": admin.firestore.FieldValue.increment(1),
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
  // ERN 4.3: Check DisplayTitleText first (direct under Release)
  if (release.DisplayTitleText || release.displaytitletext) {
    return release.DisplayTitleText || release.displaytitletext;
  }
  
  // ERN 4.3: Check ReferenceTitle
  if (release.ReferenceTitle?.TitleText) {
    return release.ReferenceTitle.TitleText;
  }
  
  // ERN 3.x: Check ReleaseDetailsByTerritory
  if (release.ReleaseDetailsByTerritory?.[0]?.Title?.TitleText) {
    return release.ReleaseDetailsByTerritory[0].Title.TitleText;
  }
  
  return "Unknown Title";
}

function extractArtist(release) {
  // ERN 4.3: Check DisplayArtist directly under Release
  if (release.DisplayArtist) {
    const artist = release.DisplayArtist;
    return artist.PartyName?.FullName || 
           artist.partyname?.fullname || 
           artist.Name || 
           artist.name ||
           "Unknown Artist";
  }
  
  // ERN 3.x: Check ReleaseDetailsByTerritory
  if (release.ReleaseDetailsByTerritory?.[0]?.DisplayArtist) {
    const artist = release.ReleaseDetailsByTerritory[0].DisplayArtist;
    return artist.PartyName?.FullName || artist.Name || "Unknown Artist";
  }
  
  return "Unknown Artist";
}

function extractRecordingArtist(recording) {
  // ERN 4.3: Check DisplayArtist directly under SoundRecording
  if (recording.DisplayArtist) {
    const artist = recording.DisplayArtist;
    // Handle nested PartyName structure
    if (artist.PartyName?.FullName) {
      return artist.PartyName.FullName;
    }
    if (artist.partyname?.fullname) {
      return artist.partyname.fullname;
    }
    if (artist.Name || artist.name) {
      return artist.Name || artist.name;
    }
    // If DisplayArtist is a string
    if (typeof artist === 'string') {
      return artist;
    }
  }
  
  // Fallback to Contributor if no DisplayArtist
  if (recording.Contributor) {
    const contributors = Array.isArray(recording.Contributor) ? recording.Contributor : [recording.Contributor];
    const mainContributor = contributors.find(c => c.Role === 'MainArtist') || contributors[0];
    if (mainContributor?.PartyName?.FullName) {
      return mainContributor.PartyName.FullName;
    }
  }
  
  return null; // Don't return "Unknown Artist" here, let the caller handle it
}

function extractLabel(release) {
  // ERN 4.3: Check LabelName directly under Release
  if (release.LabelName || release.labelname) {
    const labelName = release.LabelName || release.labelname;
    return Array.isArray(labelName) ? labelName[0] : labelName;
  }
  
  // ERN 3.x: Check ReleaseDetailsByTerritory
  if (release.ReleaseDetailsByTerritory?.[0]?.LabelName) {
    const labelName = release.ReleaseDetailsByTerritory[0].LabelName;
    return Array.isArray(labelName) ? labelName[0] : labelName;
  }
  
  return "Independent";
}

function extractGenres(release) {
  let genres = [];
  
  // ERN 4.3: Check Genre directly under Release
  if (release.Genre || release.genre) {
    genres = release.Genre || release.genre;
  }
  // ERN 3.x: Check ReleaseDetailsByTerritory
  else if (release.ReleaseDetailsByTerritory?.[0]?.Genre) {
    genres = release.ReleaseDetailsByTerritory[0].Genre;
  }
  
  const genreList = Array.isArray(genres) ? genres : [genres];
  return genreList.map(g => g.GenreText || g.genretext || g).filter(Boolean);
}

function extractRecordingGenres(recording) {
  const genres = recording.Genre || [];
  const genreList = Array.isArray(genres) ? genres : [genres];
  return genreList.map(g => g.GenreText || g).filter(Boolean);
}

function extractCopyright(item) {
  const copyrights = [];
  
  // Check both CLine and PLine with case variations
  const clines = item.CLine || item.cline || [];
  const clineArray = Array.isArray(clines) ? clines : [clines];
  
  clineArray.forEach(c => {
    if (c) {
      copyrights.push({
        type: "C",
        text: c.CLineText || c.clinetext || c,
        year: c.Year || c.year || null
      });
    }
  });
  
  const plines = item.PLine || item.pline || [];
  const plineArray = Array.isArray(plines) ? plines : [plines];
  
  plineArray.forEach(p => {
    if (p) {
      copyrights.push({
        type: "P",
        text: p.PLineText || p.plinetext || p,
        year: p.Year || p.year || null
      });
    }
  });
  
  return copyrights;
}

function extractTerritories(item) {
  if (!item) return ["Worldwide"];
  
  const territories = item.ReleaseDetailsByTerritory?.map(d => d.TerritoryCode) || 
                     item.TerritoryCode || 
                     [];
  
  const territoryList = Array.isArray(territories) ? territories : [territories];
  return territoryList.length > 0 ? territoryList : ["Worldwide"];
}

function extractContributors(recording) {
  const contributors = [];
  
  if (recording.Contributor) {
    const contribList = Array.isArray(recording.Contributor) ? recording.Contributor : [recording.Contributor];
    contributors.push(...contribList.map(c => ({
      name: c.PartyName?.FullName || c.Name,
      role: c.Role || "Performer"
    })));
  }
  
  return contributors;
}

function parseReleaseDate(release) {
  // ERN 4.3: Check direct date fields
  const dateStr = release.OriginalReleaseDate || 
                  release.originalreleasedate ||
                  release.ReleaseDate || 
                  release.releasedate ||
                  release.GlobalOriginalReleaseDate || 
                  release.GlobalReleaseDate || 
                  release.ReleaseDetailsByTerritory?.[0]?.ReleaseDate ||
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