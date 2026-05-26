import mongoose from "mongoose";
import { helpers as mockHelpers } from "../data/mockData.js";
import HelperProfile from "../models/HelperProfile.js";
import ServiceCategory from "../models/ServiceCategory.js";
import User from "../models/User.js";
import {
  generateUpcomingSlots,
  normalizeAvailability,
  validateAvailabilityInput,
} from "../utils/availability.js";
import { isDatabaseReady } from "../utils/dbState.js";
import { normalizeAvatarUrl } from "../utils/profile.js";
import { formatHelper } from "../utils/serializers.js";
import { fetchPublishedHelperReviews } from "../utils/reviewStats.js";

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function resolveCategoryIds(category) {
  if (!category) {
    return [];
  }

  const categories = await ServiceCategory.find({
    $or: [
      { slug: category.toLowerCase() },
      { name: new RegExp(`^${escapeRegExp(category)}$`, "i") },
    ],
  }).select("_id");

  return categories.map((item) => item._id);
}

async function resolveSingleCategory(category) {
  if (!category) {
    return null;
  }

  return ServiceCategory.findOne({
    $or: [
      { slug: category.toLowerCase() },
      { name: new RegExp(`^${escapeRegExp(category)}$`, "i") },
    ],
  });
}

function validateHelperPayload(body) {
  const requiredFields = ["fullName", "email", "phone", "serviceCategory", "city", "state"];

  const missingFields = requiredFields.filter((field) => {
    const value = body[field];
    return value === undefined || value === null || value === "";
  });

  if (missingFields.length) {
    return `Missing required fields: ${missingFields.join(", ")}`;
  }

  return null;
}

async function generateUniqueSlug(baseSlug, existingProfileId = null) {
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await HelperProfile.findOne({ slug }).select("_id");

    if (!existing || existing._id.toString() === existingProfileId?.toString()) {
      return slug;
    }

    counter += 1;
    slug = `${baseSlug}-${counter}`;
  }
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizePostalCodes(value) {
  const rawValues = Array.isArray(value)
    ? value
    : String(value || "")
        .split(/[\n,]+/)
        .map((item) => item.trim());

  return [...new Set(rawValues.map((item) => String(item || "").trim()).filter(Boolean))];
}

function normalizeCoordinate(value, minimum, maximum) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue < minimum || numericValue > maximum) {
    return Number.NaN;
  }

  return Number(numericValue.toFixed(6));
}

function normalizePortfolioPhotos(value) {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    return null;
  }

  if (value.length > 6) {
    return null;
  }

  const normalizedItems = [];

  for (const item of value) {
    const photoUrl = normalizeAvatarUrl(item);

    if (photoUrl === null) {
      return null;
    }

    if (photoUrl) {
      normalizedItems.push(photoUrl);
    }
  }

  return normalizedItems;
}

function matchesCategoryFilter(helperCategory, categoryFilter) {
  if (!categoryFilter) {
    return true;
  }

  const normalizedFilter = normalizeText(categoryFilter);
  const normalizedCategory = normalizeText(helperCategory);

  return (
    normalizedCategory === normalizedFilter || slugify(normalizedCategory) === normalizedFilter
  );
}

function matchesHelperFilters(helper, filters) {
  const { area, category, postalCode, search } = filters;
  const normalizedArea = normalizeText(area);
  const normalizedPostalCode = normalizeText(postalCode);
  const normalizedSearch = normalizeText(search);

  if (!matchesCategoryFilter(helper.category, category)) {
    return false;
  }

  if (normalizedArea) {
    const areaText = [helper.area, helper.city, helper.state]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (!areaText.includes(normalizedArea)) {
      return false;
    }
  }

  if (normalizedPostalCode) {
    const helperPostalCodes = Array.isArray(helper.postalCodes) ? helper.postalCodes : [];

    if (
      !helperPostalCodes.some((item) =>
        String(item || "").toLowerCase().includes(normalizedPostalCode)
      )
    ) {
      return false;
    }
  }

  if (normalizedSearch) {
    const searchText = [
      helper.name,
      helper.category,
      helper.bio,
      helper.area,
      helper.city,
      helper.state,
      helper.experience,
      ...(helper.tags || []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (!searchText.includes(normalizedSearch)) {
      return false;
    }
  }

  return true;
}

function compareNumericDescending(left, right) {
  return Number(right || 0) - Number(left || 0);
}

function compareNumericAscending(left, right) {
  return Number(left || 0) - Number(right || 0);
}

function sortHelpers(helpers, sortBy) {
  const list = [...helpers];

  if (sortBy === "rating_desc") {
    return list.sort((left, right) => {
      const ratingDifference = compareNumericDescending(left.rating, right.rating);

      if (ratingDifference !== 0) {
        return ratingDifference;
      }

      return compareNumericDescending(left.totalReviews, right.totalReviews);
    });
  }

  if (sortBy === "price_asc") {
    return list.sort((left, right) => {
      const priceDifference = compareNumericAscending(left.minPrice, right.minPrice);

      if (priceDifference !== 0) {
        return priceDifference;
      }

      return compareNumericDescending(left.rating, right.rating);
    });
  }

  if (sortBy === "newest") {
    return list.sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0));
  }

  return list.sort((left, right) => {
    const verifiedDifference = Number(Boolean(right.verified)) - Number(Boolean(left.verified));

    if (verifiedDifference !== 0) {
      return verifiedDifference;
    }

    const ratingDifference = compareNumericDescending(left.rating, right.rating);

    if (ratingDifference !== 0) {
      return ratingDifference;
    }

    return compareNumericAscending(left.minPrice, right.minPrice);
  });
}

function toPlainObject(value) {
  return value && typeof value.toObject === "function" ? value.toObject() : value;
}

function formatEditableHelperProfile(helperProfile, fallbackUser = null) {
  const item = toPlainObject(helperProfile);
  const user = item.user || fallbackUser || {};
  const category =
    item.serviceCategories?.[0]?.slug ||
    item.serviceCategories?.[0]?.id ||
    item.serviceCategories?.[0]?.name ||
    item.category ||
    "";
  const availability = item.availability || item.availabilityConfig || {};

  return {
    id: item.slug || item._id?.toString?.() || item.id || "",
    slug: item.slug || item._id?.toString?.() || item.id || "",
    fullName: user.fullName || item.name || "",
    email: user.email || item.email || "",
    phone: user.phone || item.phone || "",
    avatarUrl: user.avatarUrl || item.avatarUrl || "",
    headline: item.headline || "",
    bio: item.bio || "",
    serviceCategory: category,
    yearsOfExperience: String(item.yearsOfExperience ?? ""),
    minPrice: String(item.pricing?.minPrice ?? item.minPrice ?? ""),
    maxPrice: String(item.pricing?.maxPrice ?? item.maxPrice ?? ""),
    priceUnit: item.pricing?.priceUnit || item.priceUnit || "per_visit",
    city: item.serviceArea?.city || item.city || "",
    state: item.serviceArea?.state || item.state || "",
    postalCodes: Array.isArray(item.serviceArea?.postalCodes)
      ? item.serviceArea.postalCodes.join(", ")
      : Array.isArray(item.postalCodes)
        ? item.postalCodes.join(", ")
        : "",
    latitude:
      Array.isArray(item.serviceArea?.coordinates) && item.serviceArea.coordinates.length >= 2
        ? String(item.serviceArea.coordinates[1])
        : item.coordinates?.latitude !== undefined
          ? String(item.coordinates.latitude)
          : "",
    longitude:
      Array.isArray(item.serviceArea?.coordinates) && item.serviceArea.coordinates.length >= 2
        ? String(item.serviceArea.coordinates[0])
        : item.coordinates?.longitude !== undefined
          ? String(item.coordinates.longitude)
          : "",
    radiusInKm: String(item.serviceArea?.radiusInKm ?? item.radiusInKm ?? 5),
    availabilityDays: Array.isArray(availability.days) ? availability.days : [],
    startTime: availability.startTime || "09:00",
    endTime: availability.endTime || "18:00",
    slotDurationMinutes: String(availability.slotDurationMinutes || 60),
    verified: Boolean(item.isVerified || item.verified),
    verificationStatus:
      item.verificationStatus || (item.isVerified || item.verified ? "approved" : "pending"),
    verificationDocumentUrl: item.verificationDocumentUrl || "",
    verificationDocumentLabel: item.verificationDocumentLabel || "",
    verificationSubmittedAt: item.verificationSubmittedAt || null,
    portfolioPhotos: Array.isArray(item.portfolioPhotos) ? item.portfolioPhotos : [],
  };
}

async function resolveCurrentHelperProfile(user) {
  return HelperProfile.findOne({ user: user._id })
    .populate("user", "fullName email phone role avatarUrl")
    .populate("serviceCategories", "name slug");
}

async function getHelpers(request, response) {
  const {
    category,
    area = "",
    postalCode = "",
    search = "",
    sortBy = "verified_desc",
  } = request.query;

  if (!isDatabaseReady()) {
    const data = sortHelpers(
      mockHelpers
        .map(formatHelper)
        .filter((helper) =>
          matchesHelperFilters(helper, { area, category, postalCode, search })
        ),
      sortBy
    );

    return response.json({
      success: true,
      message: "Helpers fetched successfully",
      data,
    });
  }

  const filter = {};

  if (category) {
    const categoryIds = await resolveCategoryIds(category);

    if (!categoryIds.length) {
      return response.json({
        success: true,
        message: "Helpers fetched successfully",
        data: [],
      });
    }

    filter.serviceCategories = { $in: categoryIds };
  }

  const helpers = await HelperProfile.find(filter)
    .populate({
      path: "user",
      select: "fullName phone role avatarUrl isActive",
      match: { isActive: true },
    })
    .populate("serviceCategories", "name slug")
    .sort({ createdAt: -1 });

  return response.json({
    success: true,
    message: "Helpers fetched successfully",
    data: sortHelpers(
      helpers
        .filter((helper) => helper.user && helper.isAvailable)
        .map(formatHelper)
        .filter((helper) =>
          matchesHelperFilters(helper, { area, category, postalCode, search })
        ),
      sortBy
    ),
  });
}

async function getHelperById(request, response) {
  if (!isDatabaseReady()) {
    const helper = mockHelpers.find((item) => item.id === request.params.id);

    if (!helper) {
      return response.status(404).json({
        success: false,
        message: "Helper not found",
        errors: null,
      });
    }

    return response.json({
      success: true,
      message: "Helper fetched successfully",
      data: helper.availabilityConfig
        ? {
            ...helper,
            bookingSlots:
              helper.bookingSlots ||
              generateUpcomingSlots(helper.availabilityConfig, {
                lookAheadDays: 10,
                maxSlots: 10,
              }),
          }
        : helper,
    });
  }

  const { id } = request.params;
  const query = { slug: id };

  if (mongoose.isValidObjectId(id)) {
    query.$or = [{ slug: id }, { _id: id }];
    delete query.slug;
  }

  const helper = await HelperProfile.findOne(query)
    .populate({
      path: "user",
      select: "fullName phone role avatarUrl isActive",
      match: { isActive: true },
    })
    .populate("serviceCategories", "name slug");

  if (!helper || !helper.user || !helper.isAvailable) {
    return response.status(404).json({
      success: false,
      message: "Helper not found",
      errors: null,
    });
  }

  const recentReviews = await fetchPublishedHelperReviews(helper._id, 6);
  const helperWithReviews = {
    ...helper.toObject(),
    reviews: recentReviews,
    bookingSlots: generateUpcomingSlots(helper.availability, {
      lookAheadDays: 10,
      maxSlots: 10,
    }),
  };

  return response.json({
    success: true,
    message: "Helper fetched successfully",
    data: formatHelper(helperWithReviews),
  });
}

async function getCurrentHelperProfile(request, response) {
  if (!isDatabaseReady()) {
    const helper =
      mockHelpers.find(
        (item) =>
          item.email === request.user?.email ||
          item.phone === request.user?.phone ||
          item.name === request.user?.fullName
      ) || null;

    if (!helper) {
      return response.status(404).json({
        success: false,
        message: "Helper profile not found",
        errors: null,
      });
    }

    return response.json({
      success: true,
      message: "Current helper profile fetched successfully",
      data: formatEditableHelperProfile(helper, request.user),
    });
  }

  const helperProfile = await resolveCurrentHelperProfile(request.user);

  if (!helperProfile) {
    return response.status(404).json({
      success: false,
      message: "Helper profile not found",
      errors: null,
    });
  }

  return response.json({
    success: true,
    message: "Current helper profile fetched successfully",
    data: formatEditableHelperProfile(helperProfile, request.user),
  });
}

async function createHelperProfile(request, response) {
  const fullName = request.body.fullName || request.user?.fullName;
  const email = request.body.email || request.user?.email;
  const phone = request.body.phone || request.user?.phone;
  const validationError = validateHelperPayload({
    ...request.body,
    fullName,
    email,
    phone,
  });

  if (validationError) {
    return response.status(400).json({
      success: false,
      message: validationError,
      errors: null,
    });
  }

  const {
    avatarUrl: nextAvatarUrl,
    verificationDocumentUrl: nextVerificationDocumentUrl,
    verificationDocumentLabel,
    headline,
    bio,
    serviceCategory,
    yearsOfExperience,
    minPrice,
    maxPrice,
    priceUnit,
    city,
    state,
    postalCodes,
    latitude,
    longitude,
    radiusInKm,
    portfolioPhotos: nextPortfolioPhotos,
    availabilityDays,
    startTime,
    endTime,
    slotDurationMinutes,
  } = request.body;
  const normalizedAvailability = normalizeAvailability({
    days: availabilityDays,
    startTime,
    endTime,
    slotDurationMinutes,
  });
  const avatarUrl = normalizeAvatarUrl(nextAvatarUrl);
  const verificationDocumentUrl = normalizeAvatarUrl(nextVerificationDocumentUrl);
  const normalizedPostalCodes = normalizePostalCodes(postalCodes);
  const coordinatesProvided = latitude !== undefined || longitude !== undefined;
  const normalizedLatitude = normalizeCoordinate(latitude, -90, 90);
  const normalizedLongitude = normalizeCoordinate(longitude, -180, 180);
  const portfolioPhotos = normalizePortfolioPhotos(nextPortfolioPhotos);
  const trimmedVerificationDocumentLabel = String(verificationDocumentLabel || "").trim();
  const availabilityError = validateAvailabilityInput(normalizedAvailability);

  if (nextAvatarUrl !== undefined && avatarUrl === null) {
    return response.status(400).json({
      success: false,
      message: "Profile photo must be a valid image URL or uploaded image",
      errors: null,
    });
  }

  if (nextVerificationDocumentUrl !== undefined && verificationDocumentUrl === null) {
    return response.status(400).json({
      success: false,
      message: "Verification document must be a valid image URL or uploaded image",
      errors: null,
    });
  }

  if (
    Number.isNaN(normalizedLatitude) ||
    Number.isNaN(normalizedLongitude) ||
    ((normalizedLatitude === null) !== (normalizedLongitude === null))
  ) {
    return response.status(400).json({
      success: false,
      message: "Latitude and longitude must both be valid coordinates",
      errors: null,
    });
  }

  if (portfolioPhotos === null) {
    return response.status(400).json({
      success: false,
      message: "Portfolio photos must be valid uploaded images and can include up to 6 items",
      errors: null,
    });
  }

  if (availabilityError) {
    return response.status(400).json({
      success: false,
      message: availabilityError,
      errors: null,
    });
  }

  if (!isDatabaseReady()) {
    const nextHelperId = `${slugify(fullName)}-${slugify(serviceCategory)}`;
    const existingHelperIndex = mockHelpers.findIndex(
      (item) =>
        item.email === email ||
        item.phone === phone ||
        item.id === nextHelperId
    );
    const existingHelper = existingHelperIndex >= 0 ? mockHelpers[existingHelperIndex] : null;
    const helperId = existingHelper?.id || nextHelperId;
    const helper = {
      ...existingHelper,
      id: helperId,
      name: fullName,
      email,
      phone,
      role: "helper",
      avatarUrl: avatarUrl || request.user?.avatarUrl || "",
      category: serviceCategory,
      city,
      state,
      postalCodes: normalizedPostalCodes,
      coordinates:
        normalizedLatitude !== null && normalizedLongitude !== null
          ? {
              latitude: normalizedLatitude,
              longitude: normalizedLongitude,
            }
          : coordinatesProvided
            ? null
            : existingHelper?.coordinates || null,
      area: `${city}, ${state}`,
      rating: 0,
      minPrice: Number(minPrice || 0),
      maxPrice: Number(maxPrice || minPrice || 0),
      priceUnit: priceUnit || "per_visit",
      price:
        priceUnit === "per_day"
          ? `Starts at Rs ${minPrice}/day`
          : priceUnit === "per_hour"
            ? `Starts at Rs ${minPrice}/hour`
            : `Starts at Rs ${minPrice}`,
      experience: `${yearsOfExperience} years experience`,
      verified: false,
      verificationStatus:
        nextVerificationDocumentUrl !== undefined
          ? "pending"
          : existingHelper?.verificationStatus || "pending",
      verificationDocumentUrl:
        nextVerificationDocumentUrl !== undefined
          ? verificationDocumentUrl || ""
          : existingHelper?.verificationDocumentUrl || "",
      verificationDocumentLabel:
        nextVerificationDocumentUrl !== undefined
          ? trimmedVerificationDocumentLabel
          : existingHelper?.verificationDocumentLabel || "",
      verificationSubmittedAt:
        nextVerificationDocumentUrl !== undefined
          ? verificationDocumentUrl
            ? new Date().toISOString()
            : null
          : existingHelper?.verificationSubmittedAt || null,
      portfolioPhotos:
        portfolioPhotos !== undefined
          ? portfolioPhotos
          : Array.isArray(existingHelper?.portfolioPhotos)
            ? existingHelper.portfolioPhotos
            : [],
      availability: `${normalizedAvailability.days.join(", ")} | ${normalizedAvailability.startTime}-${normalizedAvailability.endTime} | ${normalizedAvailability.slotDurationMinutes} min slots`,
      availabilityConfig: normalizedAvailability,
      bookingSlots: generateUpcomingSlots(normalizedAvailability, {
        lookAheadDays: 10,
        maxSlots: 8,
      }),
      bio: bio || headline || "Trusted local professional ready for service requests.",
      headline: headline || "",
      yearsOfExperience: Number(yearsOfExperience || 0),
      radiusInKm: Number(radiusInKm || 5),
      completedJobs: existingHelper?.completedJobs || 0,
      tags: [serviceCategory, "New Helper", "Available"],
      createdAt: existingHelper?.createdAt || new Date().toISOString(),
    };

    if (existingHelperIndex >= 0) {
      mockHelpers[existingHelperIndex] = helper;
    } else {
      mockHelpers.unshift(helper);
    }

    return response.status(existingHelper ? 200 : 201).json({
      success: true,
      message: existingHelper
        ? "Helper profile updated successfully"
        : "Helper profile created successfully",
      data: helper,
    });
  }

  const category = await resolveSingleCategory(serviceCategory);

  if (!category) {
    return response.status(400).json({
      success: false,
      message: "Selected service category does not exist",
      errors: null,
    });
  }

  const normalizedEmail = email.toLowerCase();
  const conflictingUser = await User.findOne({
    $and: [
      { _id: { $ne: request.user._id } },
      {
        $or: [{ email: normalizedEmail }, { phone }],
      },
    ],
  });

  if (conflictingUser) {
    return response.status(409).json({
      success: false,
      message: "Another account already uses this email or phone",
      errors: null,
    });
  }

  const user = request.user;
  user.fullName = fullName;
  user.email = normalizedEmail;
  user.phone = phone;
  if (nextAvatarUrl !== undefined) {
    user.avatarUrl = avatarUrl || "";
  }
  user.role = "helper";
  user.isActive = true;
  await user.save();

  const existingProfile = await HelperProfile.findOne({ user: user._id });
  const baseSlug = slugify(`${fullName}-${serviceCategory}`);
  const slug = existingProfile?.slug || (await generateUniqueSlug(baseSlug, existingProfile?._id));
  const shouldResetVerification = nextVerificationDocumentUrl !== undefined;

  const helperProfile = await HelperProfile.findOneAndUpdate(
    { user: user._id },
    {
      slug,
      user: user._id,
      headline: headline || "",
      bio: bio || headline || "",
      yearsOfExperience: Number(yearsOfExperience),
      serviceCategories: [category._id],
      pricing: {
        minPrice: Number(minPrice),
        maxPrice: Number(maxPrice || minPrice),
        priceUnit: priceUnit || "per_visit",
      },
      serviceArea: {
        city,
        state,
        postalCodes: normalizedPostalCodes,
        radiusInKm: Number(radiusInKm || 5),
        coordinates:
          normalizedLatitude !== null && normalizedLongitude !== null
            ? [normalizedLongitude, normalizedLatitude]
            : coordinatesProvided
              ? []
              : existingProfile?.serviceArea?.coordinates || undefined,
      },
      availability: normalizedAvailability,
      verificationDocumentLabel:
        nextVerificationDocumentUrl !== undefined
          ? trimmedVerificationDocumentLabel
          : existingProfile?.verificationDocumentLabel || "",
      verificationDocumentUrl:
        nextVerificationDocumentUrl !== undefined
          ? verificationDocumentUrl || ""
          : existingProfile?.verificationDocumentUrl || "",
      verificationSubmittedAt:
        nextVerificationDocumentUrl !== undefined
          ? verificationDocumentUrl
            ? new Date()
            : null
          : existingProfile?.verificationSubmittedAt || null,
      portfolioPhotos:
        portfolioPhotos !== undefined
          ? portfolioPhotos
          : Array.isArray(existingProfile?.portfolioPhotos)
            ? existingProfile.portfolioPhotos
            : [],
      verificationStatus: shouldResetVerification
        ? "pending"
        : existingProfile?.verificationStatus || "pending",
      isVerified: shouldResetVerification ? false : existingProfile?.isVerified || false,
      isAvailable: true,
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  )
    .populate("user", "fullName phone role avatarUrl")
    .populate("serviceCategories", "name slug");

  return response.status(existingProfile ? 200 : 201).json({
    success: true,
    message: existingProfile
      ? "Helper profile updated successfully"
      : "Helper profile created successfully",
    data: formatHelper(helperProfile),
  });
}

export { createHelperProfile, getCurrentHelperProfile, getHelperById, getHelpers };
