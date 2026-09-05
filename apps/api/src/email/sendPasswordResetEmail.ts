/**
 * No email provider is wired up yet. This is the one seam a real integration
 * plugs into later; the forgot-password route already treats a rejection
 * here as non-fatal so the endpoint keeps its generic response either way.
 */
export async function sendPasswordResetEmail(_to: string, _resetUrl: string): Promise<void> {
  throw new Error('Email is not wired to a provider yet');
}
