declare module "next-pwa/cache" {
  import type { RuntimeCaching } from "next-pwa";

  const runtimeCaching: RuntimeCaching[];
  export default runtimeCaching;
}
