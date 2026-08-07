import { R2 } from "@convex-dev/r2";
import type { ChatStorageAdapter, StoredAttachmentMetadata } from "convex-chat";

type UploadContext = Parameters<R2["syncMetadata"]>[0];
type ReadContext = Parameters<R2["getMetadata"]>[0];
type DeleteContext = Parameters<R2["deleteObject"]>[0];

export class R2ChatStorage implements ChatStorageAdapter<
  UploadContext,
  ReadContext,
  DeleteContext
> {
  readonly provider = "cloudflare-r2";
  readonly client: R2;

  constructor(
    component: ConstructorParameters<typeof R2>[0],
    options?: ConstructorParameters<typeof R2>[1],
  ) {
    this.client = new R2(component, options);
  }

  createUploadUrl(key: string) {
    return this.client.generateUploadUrl(key);
  }

  async syncMetadata(ctx: UploadContext, key: string) {
    await this.client.syncMetadata(ctx, key);
  }

  async getMetadata(
    ctx: ReadContext,
    key: string,
  ): Promise<StoredAttachmentMetadata | null> {
    const metadata = await this.client.getMetadata(ctx, key);
    if (!metadata) return null;
    return {
      storageKey: metadata.key,
      mediaType: metadata.contentType,
      size: metadata.size,
    };
  }

  getDownloadUrl(key: string, expiresInSeconds = 300) {
    return this.client.getUrl(key, { expiresIn: expiresInSeconds });
  }

  async delete(ctx: DeleteContext, key: string) {
    await this.client.deleteObject(ctx, key);
  }
}
