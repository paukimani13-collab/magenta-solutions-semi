const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const express = require('express');
const multer = require('multer');

const ROOT = path.resolve(__dirname, '..');
const DATA_FILE = path.join(__dirname, 'data', 'products.json');
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '';
const CATEGORIES = new Set([
  'laptops',
  'all-in-ones',
  'ex-uk-deals',
  'brand-new-laptops',
  'pos-systems',
  'accessories',
  'printers-scanners',
  'networking',
  'gaming',
  'apple-products',
  'service-repair',
]);
const IMAGE_TYPES = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp']
]);

if (ADMIN_TOKEN.length < 32) {
  throw new Error('Set ADMIN_TOKEN to a private value of at least 32 characters before starting the server.');
}

const app = express();
app.use((req, res, next) => {
  const origin = req.get('Origin');
  if (origin && origin === ALLOWED_ORIGIN) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Vary', 'Origin');
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.set('Access-Control-Max-Age', '600');
      res.status(204).end();
      return;
    }
  } else if (req.method === 'OPTIONS') {
    res.status(403).end();
    return;
  }
  next();
});
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, UPLOAD_DIR),
    filename: (_req, file, callback) => callback(null, `${crypto.randomUUID()}${IMAGE_TYPES.get(file.mimetype)}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 8, fieldSize: 2048 },
  fileFilter: (_req, file, callback) => {
    if (!IMAGE_TYPES.has(file.mimetype)) {
      callback(new Error('Choose a JPEG, PNG, or WebP image.'));
      return;
    }
    callback(null, true);
  },
});

let products;
let writeQueue = Promise.resolve();

async function saveProducts() {
  const contents = JSON.stringify(products, null, 2);
  writeQueue = writeQueue.catch(() => {}).then(async () => {
    const temporaryFile = `${DATA_FILE}.${crypto.randomUUID()}.tmp`;
    try {
      await fs.writeFile(temporaryFile, contents, 'utf8');
      await fs.rename(temporaryFile, DATA_FILE);
    } catch (error) {
      await fs.rm(temporaryFile, { force: true });
      throw error;
    }
  });
  return writeQueue;
}

function requireAdmin(req, res, next) {
  const authorization = req.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  const provided = Buffer.from(token);
  const expected = Buffer.from(ADMIN_TOKEN);
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    res.status(401).json({ error: 'Enter the valid admin token to manage stock.' });
    return;
  }
  next();
}

function validateProduct(req, existingProduct) {
  const { name, brand = '', specs, description = '', price, category, badge = '' } = req.body;
  const parsedPrice = Number(price);
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 120) {
    return { error: 'Product name is required and must be 120 characters or fewer.' };
  }
  if (typeof specs !== 'string' || !specs.trim() || specs.trim().length > 500) {
    return { error: 'Product specs are required and must be 500 characters or fewer.' };
  }
  if (typeof description !== 'string' || description.length > 1000) {
    return { error: 'Product details must be 1,000 characters or fewer.' };
  }
  if (typeof brand !== 'string' || brand.length > 60) {
    return { error: 'Brand must be 60 characters or fewer.' };
  }
  if (!Number.isSafeInteger(parsedPrice) || parsedPrice < 1 || parsedPrice > 100000000) {
    return { error: 'Enter a valid product price.' };
  }
  if (!CATEGORIES.has(category)) {
    return { error: 'Choose a valid product category.' };
  }
  if (typeof badge !== 'string' || badge.length > 40) {
    return { error: 'Badge must be 40 characters or fewer.' };
  }
  const inStockValue = req.body.inStock;
  const stockStatus = req.body.stockStatus;
  if (
    stockStatus !== undefined &&
    !['new-stock', 'in-stock', 'out-of-stock'].includes(stockStatus)
  ) {
    return { error: 'Choose new stock, in stock, or out of stock.' };
  }
  if (
    stockStatus === undefined &&
    inStockValue !== undefined &&
    inStockValue !== 'true' &&
    inStockValue !== 'false'
  ) {
    return { error: 'Choose whether this product is in stock.' };
  }
  if (!existingProduct && !req.file) {
    return { error: 'A product photo is required.' };
  }
  return {
    product: {
      id: existingProduct ? existingProduct.id : crypto.randomUUID(),
      name: name.trim(),
      brand: brand.trim(),
      specs: specs.trim(),
      description: description.trim(),
      price: parsedPrice,
      category,
      badge: stockStatus === 'new-stock' ? 'New Stock' : badge.trim(),
      imageUrl: req.file ? `/uploads/${req.file.filename}` : (existingProduct?.imageUrl || ''),
      inStock: stockStatus !== undefined
        ? stockStatus !== 'out-of-stock'
        : inStockValue === undefined
        ? (existingProduct?.inStock ?? true)
        : inStockValue === 'true',
      stockStatus: stockStatus || (
        inStockValue !== undefined
          ? inStockValue === 'false' ? 'out-of-stock' : 'in-stock'
          : existingProduct?.stockStatus || (
            String(badge).trim().toLowerCase() === 'new stock' ? 'new-stock' : 'in-stock'
          )
      ),
    },
  };
}

async function removeUploadedFile(file) {
  if (file) await fs.rm(path.join(UPLOAD_DIR, path.basename(file.filename)), { force: true });
}

app.get('/api/products', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(products);
});

app.get('/api/admin/verify', requireAdmin, (_req, res) => res.json({ ok: true }));

app.post('/api/products', requireAdmin, upload.single('image'), async (req, res, next) => {
  let postedProduct;
  try {
    const result = validateProduct(req);
    if (result.error) {
      await removeUploadedFile(req.file);
      res.status(400).json({ error: result.error });
      return;
    }
    postedProduct = result.product;
    products.unshift(postedProduct);
    await saveProducts();
    res.status(201).json(postedProduct);
  } catch (error) {
    if (postedProduct) products = products.filter((product) => product.id !== postedProduct.id);
    try {
      await removeUploadedFile(req.file);
    } catch (cleanupError) {
      next(cleanupError);
      return;
    }
    next(error);
  }
});

app.patch('/api/products/:id', requireAdmin, upload.single('image'), async (req, res, next) => {
  let uploadedFile = req.file;
  try {
    const index = products.findIndex((product) => product.id === req.params.id);
    if (index === -1) {
      await removeUploadedFile(uploadedFile);
      res.status(404).json({ error: 'Product was not found.' });
      return;
    }

    const previous = products[index];
    const result = validateProduct(req, previous);
    if (result.error) {
      await removeUploadedFile(uploadedFile);
      res.status(400).json({ error: result.error });
      return;
    }

    products[index] = result.product;
    try {
      await saveProducts();
    } catch (error) {
      products[index] = previous;
      await removeUploadedFile(uploadedFile);
      uploadedFile = null;
      throw error;
    }

    if (req.file && previous.imageUrl && previous.imageUrl.startsWith('/uploads/')) {
      try {
        await fs.rm(path.join(UPLOAD_DIR, path.basename(previous.imageUrl)), { force: true });
      } catch (error) {
        console.error('Unable to remove the previous product photo:', error);
      }
    }
    res.json(result.product);
  } catch (error) {
    if (uploadedFile) {
      try {
        await removeUploadedFile(uploadedFile);
      } catch (cleanupError) {
        next(cleanupError);
        return;
      }
    }
    next(error);
  }
});

app.patch('/api/products/:id/photo', requireAdmin, upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Choose a JPEG, PNG, or WebP product photo.' });
      return;
    }
    const index = products.findIndex((product) => product.id === req.params.id);
    if (index === -1) {
      await removeUploadedFile(req.file);
      res.status(404).json({ error: 'Product was not found.' });
      return;
    }

    const previous = products[index];
    const updated = { ...previous, imageUrl: `/uploads/${req.file.filename}` };
    products[index] = updated;
    try {
      await saveProducts();
    } catch (error) {
      products[index] = previous;
      await removeUploadedFile(req.file);
      throw error;
    }

    if (previous.imageUrl && previous.imageUrl.startsWith('/uploads/')) {
      try {
        await fs.rm(path.join(UPLOAD_DIR, path.basename(previous.imageUrl)), { force: true });
      } catch (error) {
        console.error('Unable to remove the previous product photo:', error);
      }
    }
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

app.delete('/api/products/:id', requireAdmin, async (req, res, next) => {
  try {
    const index = products.findIndex((product) => product.id === req.params.id);
    if (index === -1) {
      res.status(404).json({ error: 'Posted product was not found.' });
      return;
    }
    const [removed] = products.splice(index, 1);
    try {
      await saveProducts();
    } catch (error) {
      products.splice(index, 0, removed);
      throw error;
    }
    if (removed.imageUrl && removed.imageUrl.startsWith('/uploads/')) {
      await fs.rm(path.join(UPLOAD_DIR, path.basename(removed.imageUrl)), { force: true });
    }
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.use('/uploads', express.static(UPLOAD_DIR, { dotfiles: 'deny', fallthrough: false, maxAge: '1d' }));
app.use('/css', express.static(path.join(ROOT, 'css')));
app.use('/js', express.static(path.join(ROOT, 'js')));
app.use('/logos', express.static(path.join(ROOT, 'logos')));
app.use('/CardsPics', express.static(path.join(ROOT, 'CardsPics')));
app.use('/Team', express.static(path.join(ROOT, 'Team')));

const PAGES = new Set(['index.html', 'about.html', 'admin.html', 'blog.html', 'contact.html', 'services.html', 'store.html']);
app.get('/', (_req, res) => res.sendFile(path.join(ROOT, 'index.html')));
app.get('/:page', (req, res, next) => {
  if (!PAGES.has(req.params.page)) {
    next();
    return;
  }
  res.sendFile(path.join(ROOT, req.params.page));
});

app.use((_req, res) => res.status(404).json({ error: 'Not found.' }));
app.use((error, _req, res, _next) => {
  if (error.status === 404) {
    res.status(404).json({ error: 'Not found.' });
    return;
  }
  if (error instanceof multer.MulterError) {
    res.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'Image must be 5 MB or smaller.' : 'Invalid image upload.' });
    return;
  }
  if (error.message === 'Choose a JPEG, PNG, or WebP image.') {
    res.status(400).json({ error: error.message });
    return;
  }
  console.error(error);
  res.status(500).json({ error: 'The request could not be completed. Check the server logs.' });
});

async function start() {
  if (ALLOWED_ORIGIN) {
    let parsedOrigin;
    try {
      parsedOrigin = new URL(ALLOWED_ORIGIN);
    } catch {
      throw new Error('ALLOWED_ORIGIN must be a valid origin such as https://username.github.io.');
    }
    if (!['http:', 'https:'].includes(parsedOrigin.protocol) || parsedOrigin.origin !== ALLOWED_ORIGIN) {
      throw new Error('ALLOWED_ORIGIN must contain only the website origin, without a path or trailing slash.');
    }
  }
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  products = JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));
  if (!Array.isArray(products)) throw new Error('backend/data/products.json must contain a product array.');
  products = products.map((product) => ({
    ...product,
    description: typeof product.description === 'string' ? product.description : '',
    category: product.category === 'laptop' ? 'laptops' :
      product.category === 'desktop' ? 'all-in-ones' :
      product.category === 'accessory' ? 'accessories' : product.category,
    inStock: product.inStock !== false,
    stockStatus: product.inStock === false
      ? 'out-of-stock'
      : String(product.badge || '').trim().toLowerCase() === 'new stock'
      ? 'new-stock'
      : 'in-stock',
  }));
  app.listen(PORT, HOST, () => console.log(`Magenta inventory API is running at http://${HOST}:${PORT}`));
}

start().catch((error) => {
  console.error('Unable to start the inventory backend:', error);
  process.exitCode = 1;
});
