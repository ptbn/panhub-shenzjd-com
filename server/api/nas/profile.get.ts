import { defineEventHandler } from "h3";
import { requireAuthUser } from "../../utils/authSession";
import { getDatabase } from "../../core/db/index";
import type { NasProfilePublic } from "../../core/nas/types";

export default defineEventHandler(async (event) => {
  const user = await requireAuthUser(event);
  const db = await getDatabase(event);

  const profile = await db.getNasProfile(user.id);
  if (!profile) {
    return {
      profile: null,
    };
  }

  const publicProfile: NasProfilePublic = {
    id: profile.id,
    userId: profile.userId,
    name: profile.name,
    isDefault: Boolean(profile.isDefault),
    cloudDriveEnabled: Boolean(profile.cloudDriveEnabled),
    alistUrl: profile.alistUrl,
    alistHasToken: Boolean(profile.alistTokenEncrypted),
    alistDefaultPath: profile.alistDefaultPath,
    torrentClientType: profile.torrentClientType,
    torrentClientUrl: profile.torrentClientUrl,
    torrentHasSecret: Boolean(profile.torrentClientSecretEncrypted),
    torrentDefaultDir: profile.torrentDefaultDir,
    updatedAt: profile.updatedAt,
  };

  return {
    profile: publicProfile,
  };
});
