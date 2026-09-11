import { defineEventHandler, getQuery } from "h3";
import { fetchSubhdSubtitles } from "../core/services/subhdService";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const doubanId = typeof query.doubanId === "string" ? query.doubanId.trim() : undefined;
  const keyword = typeof query.keyword === "string" ? query.keyword.trim() : undefined;

  try {
    const data = await fetchSubhdSubtitles({ doubanId, keyword });

    return {
      code: 0,
      message: "success",
      data,
    };
  } catch (error: any) {
    return {
      code: 500,
      message: `获取字幕失败: ${error?.message || "unknown"}`,
      data: {
        doubanId,
        keyword,
        subhdUrl: "https://subhd.cc",
        items: [],
        total: 0,
      },
    };
  }
});
