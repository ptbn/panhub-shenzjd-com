import { defineEventHandler, getQuery } from "h3";
import { fetchDoubanExplore } from "../core/services/doubanExploreService";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const type = (query.type as string) || "all";
  const genre = (query.genre as string) || "all";
  const yearRange = (query.yearRange as string) || "all";
  const scoreRange = (query.scoreRange as string) || "all";
  const sort = (query.sort as string) || "U";
  const rawPage = parseInt((query.page as string) || "1", 10);
  const rawLimit = parseInt((query.limit as string) || "20", 10);
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1;
  const limit = Number.isFinite(rawLimit) && rawLimit >= 1 && rawLimit <= 50 ? rawLimit : 20;

  try {
    const data = await fetchDoubanExplore({
      type,
      genre,
      yearRange,
      scoreRange,
      sort,
      page,
      limit,
    });

    return {
      code: 0,
      message: "success",
      data,
    };
  } catch (error: any) {
    return {
      code: 500,
      message: `探索影视数据失败: ${error?.message || "unknown"}`,
      data: {
        items: [],
        hasMore: false,
        page,
        limit,
        query: { type, genre, yearRange, scoreRange, sort },
      },
    };
  }
});
