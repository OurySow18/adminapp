import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "../firebase";

export const slugify = (text) => {
  if (!text) return "";
  return text
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
};

const ensureUniqueSlugInCollection = async (collectionName, title, docId) => {
  const base = slugify(title);
  if (!base) return "";

  let attempt = base;
  let suffix = 1;

  while (true) {
    const q = query(
      collection(db, collectionName),
      where("slug", "==", attempt),
      limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) return attempt;
    const hit = snap.docs[0];
    if (docId && hit.id === docId) return attempt;
    suffix += 1;
    attempt = `${base}-${suffix}`;
  }
};

export const ensureUniqueSlug = async (title, docId) =>
  ensureUniqueSlugInCollection("products_public", title, docId);

export const ensureUniqueVendorSlug = async (title, docId) =>
  ensureUniqueSlugInCollection("vendors", title, docId);
