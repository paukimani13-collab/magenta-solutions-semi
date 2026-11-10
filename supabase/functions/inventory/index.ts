import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const adminToken = Deno.env.get("ADMIN_TOKEN") ?? "";
const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN") ?? "";
const bucketName = "product-images";
const maxImageSize = 5 * 1024 * 1024;
const imageExtensions = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);
const categories = new Set([
  "laptops",
  "all-in-ones",
  "ex-uk-deals",
  "brand-new-laptops",
  "pos-systems",
  "accessories",
  "printers-scanners",
  "networking",
  "gaming",
  "apple-products",
  "service-repair",
]);

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}
if (adminToken.length < 32) {
  throw new Error("Set ADMIN_TOKEN to a private value of at least 32 characters.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const encoder = new TextEncoder();

function corsHeaders(origin: string | null): Headers {
  const headers = new Headers({
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Max-Age": "600",
    "Vary": "Origin",
  });
  if (allowedOrigin) {
    if (origin === allowedOrigin) headers.set("Access-Control-Allow-Origin", allowedOrigin);
  } else {
    headers.set("Access-Control-Allow-Origin", "*");
  }
  return headers;
}

function jsonResponse(body: unknown, status: number, headers: Headers): Response {
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(body), { status, headers });
}

function errorResponse(message: string, status: number, headers: Headers): Response {
  return jsonResponse({ error: message }, status, headers);
}

async function matchesAdminToken(providedToken: string): Promise<boolean> {
  const [providedDigest, expectedDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(providedToken)),
    crypto.subtle.digest("SHA-256", encoder.encode(adminToken)),
  ]);
  const provided = new Uint8Array(providedDigest);
  const expected = new Uint8Array(expectedDigest);
  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) {
    mismatch |= provided[index] ^ expected[index];
  }
  return mismatch === 0;
}

async function requireAdmin(request: Request): Promise<boolean> {
  const authorization = request.headers.get("Authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  return matchesAdminToken(token);
}

function toProduct(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    specs: row.specs,
    description: row.description,
    price: row.price,
    category: row.category,
    badge: row.badge,
    imageUrl: row.image_url,
    inStock: row.in_stock,
  };
}

function parseProduct(form: FormData, existing?: Record<string, unknown>) {
  const name = form.get("name");
  const brand = form.get("brand") ?? "";
  const specs = form.get("specs");
  const description = form.get("description") ?? "";
  const price = Number(form.get("price"));
  const category = form.get("category");
  const badge = form.get("badge") ?? "";
  const inStockValue = form.get("inStock");
  const imageField = form.get("image");
  const image = imageField instanceof File && imageField.size > 0 ? imageField : null;

  if (typeof name !== "string" || !name.trim() || name.trim().length > 120) {
    return { error: "Product name is required and must be 120 characters or fewer." };
  }
  if (typeof specs !== "string" || !specs.trim() || specs.trim().length > 500) {
    return { error: "Product specs are required and must be 500 characters or fewer." };
  }
  if (typeof description !== "string" || description.length > 1000) {
    return { error: "Product details must be 1,000 characters or fewer." };
  }
  if (typeof brand !== "string" || brand.length > 60) {
    return { error: "Brand must be 60 characters or fewer." };
  }
  if (!Number.isSafeInteger(price) || price < 1 || price > 100000000) {
    return { error: "Enter a valid product price." };
  }
  if (typeof category !== "string" || !categories.has(category)) {
    return { error: "Choose a valid product category." };
  }
  if (typeof badge !== "string" || badge.length > 40) {
    return { error: "Badge must be 40 characters or fewer." };
  }
  if (inStockValue !== null && inStockValue !== "true" && inStockValue !== "false") {
    return { error: "Choose whether this product is in stock." };
  }
  if (!existing && !image) return { error: "A product photo is required." };
  if (image && (!imageExtensions.has(image.type) || image.size > maxImageSize)) {
    return { error: "Choose a JPEG, PNG, or WebP image that is 5 MB or smaller." };
  }

  return {
    image,
    values: {
      name: name.trim(),
      brand: brand.trim(),
      specs: specs.trim(),
      description: description.trim(),
      price,
      category,
      badge: badge.trim(),
      in_stock: inStockValue === null ? existing?.in_stock ?? true : inStockValue === "true",
    },
  };
}

async function uploadImage(image: File): Promise<{ path: string; url: string }> {
  const path = `${crypto.randomUUID()}.${imageExtensions.get(image.type)}`;
  const { error } = await supabase.storage.from(bucketName).upload(path, image, {
    contentType: image.type,
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(bucketName).getPublicUrl(path);
  return { path, url: data.publicUrl };
}

function imagePathFromUrl(imageUrl: unknown): string | null {
  if (typeof imageUrl !== "string") return null;
  const prefix = `${supabaseUrl}/storage/v1/object/public/${bucketName}/`;
  if (!imageUrl.startsWith(prefix)) return null;
  return imageUrl.slice(prefix.length);
}

async function removeImage(imageUrl: unknown): Promise<void> {
  const path = imagePathFromUrl(imageUrl);
  if (!path) return;
  const { error } = await supabase.storage.from(bucketName).remove([path]);
  if (error) throw error;
}

async function handleRequest(request: Request): Promise<Response> {
  const origin = request.headers.get("Origin");
  const headers = corsHeaders(origin);
  if (allowedOrigin && origin !== allowedOrigin) {
    return errorResponse("This website origin is not allowed.", 403, headers);
  }
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });

  const url = new URL(request.url);
  const route = url.pathname.replace(/^\/functions\/v1\/inventory/, "") || "/";
  if (request.method === "GET" && route === "/api/products") {
    const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return jsonResponse((data ?? []).map(toProduct), 200, headers);
  }
  if (request.method === "GET" && route === "/api/admin/verify") {
    if (!(await requireAdmin(request))) {
      return errorResponse("Enter the valid admin token to manage stock.", 401, headers);
    }
    return jsonResponse({ ok: true }, 200, headers);
  }

  const match = route.match(/^\/api\/products\/([^/]+)(\/photo)?$/);
  const isCreate = request.method === "POST" && route === "/api/products";
  const isUpdate = request.method === "PATCH" && match && !match[2];
  const isPhotoUpdate = request.method === "PATCH" && match && match[2] === "/photo";
  const isDelete = request.method === "DELETE" && match && !match[2];
  if (!isCreate && !isUpdate && !isPhotoUpdate && !isDelete) {
    return errorResponse("Not found.", 404, headers);
  }
  if (!(await requireAdmin(request))) {
    return errorResponse("Enter the valid admin token to manage stock.", 401, headers);
  }

  if (isDelete && match) {
    const id = decodeURIComponent(match[1]);
    const { data: removed, error: removeError } = await supabase
      .from("products")
      .delete()
      .eq("id", id)
      .select("image_url")
      .maybeSingle();
    if (removeError) throw removeError;
    if (!removed) return errorResponse("Posted product was not found.", 404, headers);
    try {
      await removeImage(removed.image_url);
    } catch (error) {
      console.error("Unable to remove the deleted product photo:", error);
    }
    return new Response(null, { status: 204, headers });
  }

  if (isPhotoUpdate && match) {
    const id = decodeURIComponent(match[1]);
    const form = await request.formData();
    const imageField = form.get("image");
    const image = imageField instanceof File && imageField.size > 0 ? imageField : null;
    if (!image || !imageExtensions.has(image.type) || image.size > maxImageSize) {
      return errorResponse("Choose a JPEG, PNG, or WebP product photo that is 5 MB or smaller.", 400, headers);
    }
    const { data: previous, error: lookupError } = await supabase
      .from("products")
      .select("image_url")
      .eq("id", id)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!previous) return errorResponse("Product was not found.", 404, headers);
    const uploaded = await uploadImage(image);
    const { data: updated, error: updateError } = await supabase
      .from("products")
      .update({ image_url: uploaded.url })
      .eq("id", id)
      .select("*")
      .single();
    if (updateError) {
      await removeImage(uploaded.url);
      throw updateError;
    }
    try {
      await removeImage(previous.image_url);
    } catch (error) {
      console.error("Unable to remove the previous product photo:", error);
    }
    return jsonResponse(toProduct(updated), 200, headers);
  }

  if ((isCreate || isUpdate) && (isCreate || match)) {
    const form = await request.formData();
    let existing: Record<string, unknown> | undefined;
    if (isUpdate && match) {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", decodeURIComponent(match[1]))
        .maybeSingle();
      if (error) throw error;
      if (!data) return errorResponse("Product was not found.", 404, headers);
      existing = data;
    }
    const parsed = parseProduct(form, existing);
    if ("error" in parsed) return errorResponse(parsed.error, 400, headers);
    let imageUrl = existing?.image_url ?? "";
    if (parsed.image) {
      const uploaded = await uploadImage(parsed.image);
      imageUrl = uploaded.url;
    }
    const values = { ...parsed.values, image_url: imageUrl };
    const result = isCreate
      ? await supabase.from("products").insert({ id: crypto.randomUUID(), ...values }).select("*").single()
      : await supabase.from("products").update(values).eq("id", existing?.id).select("*").single();
    if (result.error) {
      if (parsed.image) {
        try {
          await removeImage(imageUrl);
        } catch (error) {
          console.error("Unable to remove an image after a failed product save:", error);
        }
      }
      throw result.error;
    }
    if (existing && parsed.image) {
      try {
        await removeImage(existing.image_url);
      } catch (error) {
        console.error("Unable to remove the previous product photo:", error);
      }
    }
    return jsonResponse(toProduct(result.data), isCreate ? 201 : 200, headers);
  }
  return errorResponse("Not found.", 404, headers);
}

Deno.serve(async (request: Request) => {
  try {
    return await handleRequest(request);
  } catch (error) {
    console.error("Inventory request failed:", error);
    return errorResponse(
      "The request could not be completed. Check the Supabase function logs.",
      500,
      corsHeaders(request.headers.get("Origin")),
    );
  }
});
