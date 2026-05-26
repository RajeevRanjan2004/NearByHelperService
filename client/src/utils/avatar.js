function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Image file could not be read"));
    reader.readAsDataURL(file);
  });
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Selected image is not supported"));
    image.src = source;
  });
}

async function createAvatarDataUrl(file, options = {}) {
  if (!file) {
    return "";
  }

  const maxSize = options.size || 256;
  const quality = options.quality || 0.82;
  const source = await readFileAsDataUrl(file);
  const image = await loadImage(source);
  const cropSize = Math.min(image.width, image.height);
  const offsetX = (image.width - cropSize) / 2;
  const offsetY = (image.height - cropSize) / 2;
  const canvas = document.createElement("canvas");

  canvas.width = maxSize;
  canvas.height = maxSize;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Image processing is not available in this browser");
  }

  context.drawImage(
    image,
    offsetX,
    offsetY,
    cropSize,
    cropSize,
    0,
    0,
    maxSize,
    maxSize
  );

  return canvas.toDataURL("image/jpeg", quality);
}

async function createDocumentDataUrl(file, options = {}) {
  if (!file) {
    return "";
  }

  const maxWidth = options.maxWidth || 1440;
  const maxHeight = options.maxHeight || 1440;
  const quality = options.quality || 0.88;
  const source = await readFileAsDataUrl(file);
  const image = await loadImage(source);
  const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);
  const canvas = document.createElement("canvas");
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Image processing is not available in this browser");
  }

  context.drawImage(image, 0, 0, width, height);

  return canvas.toDataURL("image/jpeg", quality);
}

export { createAvatarDataUrl, createDocumentDataUrl };
