/**
 * Text of a file chosen with the document picker. Reading through fetch works for file and content
 * addresses alike; the newer file API refuses picked paths in Expo Go with a "Missing READ permission" error.
 */
export async function readPickedFile(uri: string): Promise<string> {
  const response = await fetch(uri);
  if (!response.ok && response.status !== 0) throw new Error(`Could not read the file (${response.status})`);
  return response.text();
}
