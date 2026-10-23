// Hands a file dropped on one page (the home hero) to the import tool on the
// next. Client-side navigation keeps this module alive, so no storage needed.

let pending: File | null = null;

export function setPendingUpload(file: File): void {
  pending = file;
}

export function takePendingUpload(): File | null {
  const file = pending;
  pending = null;
  return file;
}
