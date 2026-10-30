/** Draft for @quasar/app-vite v3 ONLY. Adapt to the version-specific CLI SSG contract.
 * Never request Feathers notes or user sessions during build-time rendering.
 */
export async function getSsgPages() {
  return [ '/', '/about' ]
}
