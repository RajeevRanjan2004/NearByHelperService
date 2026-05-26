import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import mongoose from "mongoose";
import HelperProfile from "../models/HelperProfile.js";
import ServiceCategory from "../models/ServiceCategory.js";
import User from "../models/User.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.resolve(__dirname, "../../.env"),
});

const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  throw new Error("MONGODB_URI is required to seed the database.");
}

const categoryData = [
  {
    name: "Electrician",
    slug: "electrician",
    icon: "EL",
    description: "Switches, wiring, and home electrical repairs.",
  },
  {
    name: "Plumber",
    slug: "plumber",
    icon: "PL",
    description: "Leaks, fittings, and bathroom or kitchen support.",
  },
  {
    name: "Mechanic",
    slug: "mechanic",
    icon: "MC",
    description: "Bike, scooter, and car repair support.",
  },
  {
    name: "Maid",
    slug: "maid",
    icon: "MD",
    description: "Cleaning and regular home support services.",
  },
  {
    name: "Carpenter",
    slug: "carpenter",
    icon: "CP",
    description: "Furniture repair and woodwork jobs.",
  },
  {
    name: "Driver",
    slug: "driver",
    icon: "DR",
    description: "Local commute, office, and outstation driving support.",
  },
  {
    name: "AC Technician",
    slug: "ac-technician",
    icon: "AC",
    description: "Cooling, installation, and seasonal AC servicing.",
  },
  {
    name: "Elder Care",
    slug: "elder-care",
    icon: "EC",
    description: "Home support and assistance for senior citizens.",
  },
  {
    name: "Painter",
    slug: "painter",
    icon: "PT",
    description: "Wall painting, touch-up work, and finishing support.",
  },
];

const helperUserData = [];

const demoHelperEmails = [
  "rakesh@example.com",
  "salma@example.com",
  "irfan@example.com",
  "deepak@example.com",
  "arjun@example.com",
  "naveen@example.com",
];

const demoHelperSlugs = [
  "rakesh-electrician",
  "salma-maid",
  "irfan-plumber",
  "deepak-driver",
  "arjun-mechanic",
  "naveen-ac-technician",
];

const adminUserData = [
  {
    fullName: "Nearby Admin",
    email: "admin@example.com",
    phone: "9000000999",
    role: "admin",
    seedPassword: "Admin@123",
  },
];

async function upsertCategories() {
  const categoryMap = new Map();

  for (const category of categoryData) {
    const savedCategory = await ServiceCategory.findOneAndUpdate(
      { slug: category.slug },
      category,
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    categoryMap.set(category.slug, savedCategory);
  }

  return categoryMap;
}

async function upsertUsers() {
  const userMap = new Map();
  const appUsers = [
    ...helperUserData.map((user) => ({
      ...user,
      seedPassword: "Helper@123",
    })),
    ...adminUserData,
  ];

  for (const user of appUsers) {
    const passwordHash = await bcrypt.hash(user.seedPassword, 10);

    const savedUser = await User.findOneAndUpdate(
      { email: user.email },
      {
        ...user,
        passwordHash,
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    userMap.set(user.email, savedUser);
  }

  return userMap;
}

async function removeDemoHelpers() {
  const demoUsers = await User.find({ email: { $in: demoHelperEmails } }).select("_id");
  const demoUserIds = demoUsers.map((user) => user._id);

  await HelperProfile.deleteMany({
    $or: [{ slug: { $in: demoHelperSlugs } }, { user: { $in: demoUserIds } }],
  });

  await User.deleteMany({ email: { $in: demoHelperEmails } });
}

async function upsertHelperProfiles(categoryMap, userMap) {
  const helperProfiles = [];

  for (const profile of helperProfiles) {
    const user = userMap.get(profile.userEmail);
    const category = categoryMap.get(profile.categorySlug);

    if (!user || !category) {
      continue;
    }

    await HelperProfile.findOneAndUpdate(
      { slug: profile.slug },
      {
        slug: profile.slug,
        user: user._id,
        serviceCategories: [category._id],
        headline: profile.headline,
        bio: profile.bio,
        yearsOfExperience: profile.yearsOfExperience,
        pricing: profile.pricing,
        serviceArea: profile.serviceArea,
        availability: profile.availability,
        isVerified: profile.isVerified,
        verificationStatus: profile.verificationStatus,
        averageRating: profile.averageRating,
        totalReviews: profile.totalReviews,
        completedJobs: profile.completedJobs,
        isAvailable: profile.isAvailable,
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  }
}

async function seed() {
  await mongoose.connect(mongoUri);

  await removeDemoHelpers();
  const categoryMap = await upsertCategories();
  const userMap = await upsertUsers();
  await upsertHelperProfiles(categoryMap, userMap);

  console.log("Seed completed successfully.");
  await mongoose.disconnect();
}

seed().catch(async (error) => {
  console.error("Seed failed:", error.message);
  await mongoose.disconnect();
  process.exit(1);
});
