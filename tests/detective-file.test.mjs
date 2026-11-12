import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Exercise the exact shipped UMD bundle and application's actual options, not a mock.
globalThis.self = globalThis;
await import('../public/detective/vendor/exifr-7.1.3.js');
const app = fs.readFileSync(new URL('../public/detective/app.js', import.meta.url), 'utf8');
const labelsSource = app.match(/const metadataLabels = (\{[^;]+\});/)[1];
const optionsSource = app.match(/exifr\.parse\(bytes, (\{[^;]+\})\);/)[1];
const options = Function(`const metadataLabels = ${labelsSource}; return (${optionsSource});`)();

// Reproducible, fictional one-pixel grayscale TIFF with IFD0, EXIF and GPS IFDs.
// No user photos or real location data are included.
function fixtureTiff(southWest = false) {
  const b = Buffer.alloc(1024); b.write('II'); b.writeUInt16LE(42, 2); b.writeUInt32LE(8, 4);
  const ifd0 = 8, exif = 8 + 2 + 13 * 12 + 4, gps = exif + 2 + 12 + 4;
  let data = gps + 2 + 4 * 12 + 4;
  function ifd(offset, entries) {
    b.writeUInt16LE(entries.length, offset);
    entries.forEach(([tag, type, value], i) => {
      const at = offset + 2 + i * 12;
      b.writeUInt16LE(tag, at); b.writeUInt16LE(type, at + 2);
      let bytes, count;
      if (type === 2) { bytes = Buffer.from(value + '\0'); count = bytes.length; }
      else if (type === 5) { count = value.length; bytes = Buffer.alloc(count * 8); value.forEach((v, n) => { bytes.writeUInt32LE(v, n * 8); bytes.writeUInt32LE(1, n * 8 + 4); }); }
      else { count = 1; bytes = Buffer.alloc(type === 3 ? 2 : 4); type === 3 ? bytes.writeUInt16LE(value) : bytes.writeUInt32LE(value); }
      b.writeUInt32LE(count, at + 4);
      if (bytes.length <= 4) bytes.copy(b, at + 8);
      else { b.writeUInt32LE(data, at + 8); bytes.copy(b, data); data += bytes.length; }
    });
  }
  // Reserve a known pixel position outside all tag values.
  ifd(ifd0, [[256,4,1],[257,4,1],[258,3,8],[259,3,1],[262,3,1],
    [271,2,'Synthetic Camera'],[272,2,'Fixture One'],[273,4,1000],
    [277,3,1],[278,4,1],[279,4,1],[34665,4,exif],[34853,4,gps]]);
  ifd(exif, [[36867,2,'2026:01:02 03:04:05']]);
  ifd(gps, [[1,2,southWest?'S':'N'],[2,5,[12,30,0]],[3,2,southWest?'W':'E'],[4,5,[34,15,0]]]);
  b[1000] = 128;
  return b.subarray(0,1001);
}
const pixelJpeg = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oACAEBAAA/ACv/2Q==', 'base64');
function fixtureJpeg(southWest) {
  const tiff = fixtureTiff(southWest), length = Buffer.alloc(2); length.writeUInt16BE(tiff.length + 8);
  return Buffer.concat([pixelJpeg.subarray(0,2), Buffer.from([255,225]), length, Buffer.from('Exif\0\0'), tiff, pixelJpeg.subarray(2)]);
}
for (const [format, build] of [['TIFF',fixtureTiff], ['JPEG',fixtureJpeg]]) {
  for (const southWest of [false,true]) test(`${format}: actual app options preserve camera/date and decode ${southWest?'south/west':'north/east'} GPS without changing bytes`, async () => {
    const bytes = Uint8Array.from(build(southWest)).buffer;
    const before = Buffer.from(bytes).toString('hex');
    const result = await exifr.parse(bytes, options);
    assert.equal(result.Make, 'Synthetic Camera');
    assert.equal(result.Model, 'Fixture One');
    assert.equal(result.DateTimeOriginal, '2026:01:02 03:04:05');
    assert.equal(result.latitude, southWest ? -12.5 : 12.5);
    assert.equal(result.longitude, southWest ? -34.25 : 34.25);
    assert.equal(Buffer.from(bytes).toString('hex'), before);
  });
}
test('JPEG without EXIF returns no invented camera or location', async () => {
  const result = await exifr.parse(Uint8Array.from(pixelJpeg).buffer, options);
  for (const key of ['Make','Model','DateTimeOriginal','latitude','longitude']) assert.equal(result?.[key], undefined);
});
for (const [name, data] of [['empty',Buffer.alloc(0)], ['invalid',Buffer.from('not an image')]]) {
  test(`${name} fails safely without modifying original bytes`, async () => {
    const bytes = Uint8Array.from(data).buffer, before = Buffer.from(bytes).toString('hex');
    await assert.rejects(exifr.parse(bytes, options));
    assert.equal(Buffer.from(bytes).toString('hex'), before);
  });
}

test('truncated recognized TIFF does not invent metadata or change bytes', async () => {
  const bytes = Uint8Array.from(fixtureTiff().subarray(0,8)).buffer;
  const before = Buffer.from(bytes).toString('hex');
  const result = await exifr.parse(bytes, options);
  assert.ok(result.errors?.length > 0, 'exifr reports this truncation as resolved errors, not rejection');
  for (const key of ['Make','Model','DateTimeOriginal','latitude','longitude']) assert.equal(result[key], undefined);
  assert.equal(Buffer.from(bytes).toString('hex'), before);
});
