import ServiceCategory from "../models/ServiceCategory.js";
import { isDatabaseReady } from "../utils/dbState.js";
import { formatCategory } from "../utils/serializers.js";
import { categories as mockCategories } from "../data/mockData.js";

async function getCategories(_request, response) {
  const data = isDatabaseReady()
    ? await ServiceCategory.find({ isActive: true }).sort({ name: 1 })
    : mockCategories;

  response.json({
    success: true,
    message: "Categories fetched successfully",
    data: data.map(formatCategory),
  });
}

export { getCategories };
