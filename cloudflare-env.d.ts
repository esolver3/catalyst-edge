declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    CMC_API_KEY?: string;
    BUCKET?: R2Bucket;
  }
}
