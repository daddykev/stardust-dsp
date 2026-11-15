// functions/ingestion/hash.js
// Reads the MD5 a message declares for a file, and reports what the transfer
// validation actually did.
//
// ERN 4.x puts the algorithm in Algorithm and the digest in HashSumValue. ERN
// 3.8.x nests the same facts under HashSumAlgorithmType and HashSum. Reading only
// the 3.8.x shape leaves every 4.x delivery with no expected hash, so nothing is
// compared and the transfer still reports a passed validation.

function text(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object') {
    const inner = value._ ?? value['#text'] ?? value.value;
    return typeof inner === 'string' ? inner.trim() || null : null;
  }
  return null;
}

function first(value) {
  return Array.isArray(value) ? value[0] : value;
}

// Finds the File element a resource describes. ERN 3.x keeps TechnicalDetails on
// the resource itself; ERN 4.x nests it under SoundRecordingEdition and wraps the
// file in DeliveryFile. Looking only at the 3.x path finds no file name and no
// hash for a 4.x delivery, which is what the transfer validation depends on.
function fileFromResource(value) {
  const resource = first(value);
  if (!resource) return null;

  const edition = first(
    resource.SoundRecordingEdition ?? resource.SOUNDRECORDINGEDITION ?? resource.soundRecordingEdition
  );

  const details = first(
    resource.TechnicalDetails ??
      resource.TECHNICALDETAILS ??
      resource.technicalDetails ??
      edition?.TechnicalDetails ??
      edition?.TECHNICALDETAILS ??
      edition?.technicalDetails
  );

  if (!details) return null;

  const deliveryFile = first(
    details.DeliveryFile ?? details.DELIVERYFILE ?? details.deliveryFile
  );

  const file = first(
    deliveryFile?.File ??
      deliveryFile?.FILE ??
      deliveryFile?.file ??
      details.File ??
      details.FILE ??
      details.file
  );

  return file ?? null;
}

function declaredMd5(file) {
  const hashSum = file?.HashSum ?? file?.HASHSUM ?? file?.hashSum;
  if (!hashSum) return null;

  const algorithm = text(
    hashSum.HashSumAlgorithmType ??
      hashSum.HASHSUMALGORITHMTYPE ??
      hashSum.hashSumAlgorithmType ??
      hashSum.Algorithm ??
      hashSum.ALGORITHM ??
      hashSum.algorithm
  );

  if (!algorithm || algorithm.toUpperCase() !== 'MD5') return null;

  const digest = text(
    hashSum.HashSumValue ??
      hashSum.HASHSUMValue ??
      hashSum.HASHSUMVALUE ??
      hashSum.hashSumValue ??
      hashSum.HashSum ??
      hashSum.HASHSUM ??
      hashSum.hashSum
  );

  return digest ? digest.toLowerCase() : null;
}

// 'passed' claims a comparison succeeded, so it is only reported when at least
// one file was actually compared. A delivery with no declared hashes is
// 'not_checked', which is what it is.
function md5Status(files) {
  const compared = files.filter(file => file.md5Valid === true || file.md5Valid === false);

  if (compared.some(file => file.md5Valid === false)) return 'warnings';
  return compared.length > 0 ? 'passed' : 'not_checked';
}

module.exports = { declaredMd5, fileFromResource, md5Status };
