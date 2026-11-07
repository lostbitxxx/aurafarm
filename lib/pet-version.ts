import { petDownloadUrl } from "./pet-device";

export const PET_VERSION = "0.1.0";

export function petVersionPayload(downloadValue: string | undefined) {
  return {
    version: PET_VERSION,
    download_url: petDownloadUrl(downloadValue) ?? "",
  };
}
