export function computeDiscounted(productsData: any[]) {
  const now = new Date();
  return productsData.flatMap((category) =>
    category.products
      .map((product) => {
        const { price, discountPrice, discountPercent, discountValidUntil } = product;
        const until = discountValidUntil ? new Date(discountValidUntil) : null;

        const hasValidUntil = until instanceof Date && !isNaN(until);
        const hasTimeValid = hasValidUntil && until > now;

        const hasValidDiscountPrice =
          typeof discountPrice === 'number' &&
          discountPrice > 0 &&
          discountPrice < price &&
          hasTimeValid;

        const hasValidDiscountPercent =
          typeof discountPercent === 'number' &&
          discountPercent > 0 &&
          discountPercent < 100 &&
          hasTimeValid;

        const isDiscounted = (hasValidDiscountPrice || hasValidDiscountPercent) && hasTimeValid;

        const finalDiscountPrice = hasValidDiscountPrice
          ? discountPrice
          : hasValidDiscountPercent
          ? Math.round(price * (1 - discountPercent / 100))
          : null;

        const finalDiscountPercent = hasValidDiscountPercent
          ? discountPercent
          : hasValidDiscountPrice && finalDiscountPrice
          ? Math.round((1 - finalDiscountPrice / price) * 100)
          : null;

        return isDiscounted
          ? { ...product, finalDiscountPrice, finalDiscountPercent, categorySlug: category.slug }
          : null;
      })
      .filter(Boolean)
  );
}
