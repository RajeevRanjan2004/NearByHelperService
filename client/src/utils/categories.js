function getCategoryValue(category) {
  return category?.slug || category?.id || category?.name || "";
}

function findCategoryByValue(categoryParam, categories = []) {
  if (!categoryParam) {
    return null;
  }

  return (
    categories.find((category) => {
      const value = getCategoryValue(category);

      return [value, category?.name, category?.slug, category?.id]
        .filter(Boolean)
        .some((item) => String(item).toLowerCase() === String(categoryParam).toLowerCase());
    }) || null
  );
}

function resolveCategoryValue(categoryParam, categories = []) {
  if (!categoryParam || categoryParam === "all") {
    return "all";
  }

  const matchedCategory = findCategoryByValue(categoryParam, categories);

  return matchedCategory ? getCategoryValue(matchedCategory) : categoryParam;
}

function getCategoryLabel(categoryParam, categories = []) {
  return findCategoryByValue(categoryParam, categories)?.name || categoryParam || "";
}

export { findCategoryByValue, getCategoryLabel, getCategoryValue, resolveCategoryValue };
