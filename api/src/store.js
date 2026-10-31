/* Speicher: je Datensatz eine JSON-Datei im Blob Storage.
   Pfade: saves/<env>/<user>.json und scores/<env>/<user>.json
   Tests tauschen den Speicher über setStore() gegen eine Attrappe aus. */
const CONTAINER = 'steinzeitdorf';
let override = null;
let ready = null;

function setStore(s) { override = s; }

async function container() {
  if (!ready) {
    ready = (async () => {
      const cs = process.env.STORAGE_CONNECTION;
      if (!cs) { const e = new Error('STORAGE_CONNECTION fehlt'); e.code = 'not_configured'; throw e; }
      const { BlobServiceClient } = require('@azure/storage-blob');
      const c = BlobServiceClient.fromConnectionString(cs).getContainerClient(CONTAINER);
      await c.createIfNotExists();
      return c;
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}

const blob = {
  async get(name) {
    const c = await container();
    try {
      const buf = await c.getBlockBlobClient(name).downloadToBuffer();
      return JSON.parse(buf.toString('utf8'));
    } catch (e) {
      if (e.statusCode === 404) return null;
      throw e;
    }
  },
  async put(name, obj) {
    const c = await container();
    const s = JSON.stringify(obj);
    await c.getBlockBlobClient(name).upload(s, Buffer.byteLength(s), { blobHTTPHeaders: { blobContentType: 'application/json' } });
  },
  async list(prefix) {
    const c = await container();
    const names = [];
    for await (const b of c.listBlobsFlat({ prefix })) names.push(b.name);
    return names;
  }
};

const get = () => override || blob;
module.exports = { get, setStore };
