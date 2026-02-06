import { pgTable, serial, text, integer, boolean, timestamp, unique, jsonb, uuid } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"

// ============================================================================
// CITIES - City management for multi-tenant support (must be defined first)
// ============================================================================
export const cities = pgTable("cities", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(), // URL-friendly version
  displayName: text("display_name").notNull(),
  region: text("region"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

// ============================================================================
// EVENTS - Core event management with scoring categories
// ============================================================================
export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // e.g., "2025 Comfort Xmas Parade"
  city: text("city").notNull(), // e.g., "Comfort" (legacy, kept for backward compatibility)
  cityId: integer("city_id").references(() => cities.id, { onDelete: "set null" }), // Multi-tenant city reference
  organization: text("organization"), // Host organization (e.g., "Greater Boerne Chamber of Commerce")
  eventDate: timestamp("event_date"), // Optional date of the parade (legacy, kept for backward compatibility)
  // Note: startDate and endDate columns don't exist in actual database - removed from schema
  // startDate: timestamp("start_date"), // Start date of the event
  // endDate: timestamp("end_date"), // End date of the event
  active: boolean("active").notNull().default(true), // Whether this event is currently active
  positionMode: text("position_mode").default("preplanned").$type<"preplanned" | "jit">(), // JIT release mode
  type: text("type").$type<"parade" | "lemonade_day" | "other">(), // Event type for compliance detection
  entryCategoryTitle: text("entry_category_title").default("Best Entry"), // Customizable title for the overall/entry category
  entryAttributes: jsonb("entry_attributes").$type<{
    extraFields?: Array<{
      key: string
      label: string
      type: "text" | "textarea" | "number" | "select" | "boolean"
      required?: boolean
      placeholder?: string
      options?: string[]
      helpText?: string
    }>
  }>().default({ extraFields: [] }),
  scoringCategories: jsonb("scoring_categories").$type<Array<{
    name: string
    required?: boolean
    hasNone?: boolean
  }>>().default([
    { name: "Lighting", required: true, hasNone: true },
    { name: "Theme", required: true, hasNone: true },
    { name: "Traditions", required: true, hasNone: true },
    { name: "Spirit", required: true, hasNone: true },
    { name: "Music", required: false, hasNone: true },
  ]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

// ============================================================================
// EVENT_CATEGORIES - Dynamic scoring categories per event
// ============================================================================
export const eventCategories = pgTable(
  "event_categories",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    categoryName: text("category_name").notNull(), // e.g., "Lighting", "Theme", "Traditions"
    displayOrder: integer("display_order").notNull().default(0), // Order for UI display
    required: boolean("required").notNull().default(true), // Whether this category is required
    hasNoneOption: boolean("has_none_option").notNull().default(true), // Whether "None" option is available
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    uniqueEventCategory: unique().on(table.eventId, table.categoryName),
  })
)

// ============================================================================
// STAND_POSITIONS - Position-based location management for Lemonade Day
// ============================================================================
export const standPositions = pgTable(
  "stand_positions",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    positionNumber: integer("position_number").notNull(), // Stand number (1-50)
    locationData: jsonb("location_data").$type<{
      placeId: string        // Google Place ID (primary source of truth)
      address: string        // Formatted address
      lat: number           // Latitude (cache only)
      lng: number           // Longitude (cache only)
      placeName?: string    // Optional friendly name
      instructions?: string // Optional notes (e.g., "near fountain")
      assignedBy: string    // Coordinator ID
      assignedAt: string    // ISO timestamp
    }>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    uniqueEventPosition: unique().on(table.eventId, table.positionNumber),
  })
)

// ============================================================================
// JUDGES - Judge table with eventId (can be nullable for migration)
// ============================================================================
export const judges = pgTable(
  "judges",
  {
    id: serial("id").primaryKey(),
    accessToken: uuid("access_token").notNull().defaultRandom(),
    eventId: integer("event_id")
      .references(() => events.id, { onDelete: "cascade" }), // Nullable for migration
    name: text("name").notNull(), // Judge name (can repeat across events)
    submitted: boolean("submitted").notNull().default(false), // Submission status (legacy, will move to judge_submissions)
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    uniqueEventJudge: unique().on(table.eventId, table.name),
  })
)

// ============================================================================
// PARTICIPANTS - Historical participant data (allows quick re-entry)
// ============================================================================
export const participants = pgTable("participants", {
  id: serial("id").primaryKey(),
  organization: text("organization").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  title: text("title"),
  phone: text("phone"),
  email: text("email"),
  entryName: text("entry_name"), // Common entry name if they use the same one
  typeOfEntry: text("type_of_entry"), // Common type of entry
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

// ============================================================================
// LEMONADE DAY METADATA - TypeScript type for Lemonade Day compliance data
// ============================================================================
export type LemonadeDayMetadata = {
  // Child Participant Info
  childFirstName: string
  childLastName: string
  childAge?: number
  ageGroup: "6-8" | "9-11" | "12-14" | "15-18"
  
  // Parent/Guardian Info
  guardianName: string
  guardianEmail: string
  guardianPhone?: string  // Optional
  
  // Stand Location (use standAddress consistently)
  standAddress: string  // Required: address or description
  standName?: string    // Optional: display name for stand
  locationLat?: number  // Optional GPS
  locationLng?: number  // Optional GPS
  cityAffiliation: string // "Boerne"
  
  // Legal Acknowledgments (with timestamps)
  guardianConsent: {
    accepted: boolean
    timestamp: string
    ipAddress?: string  // Optional, captured server-side from request headers
  }
  foodSafetyAcknowledgment: {
    accepted: boolean
    timestamp: string
  }
  liabilityWaiver: {
    accepted: boolean
    timestamp: string
  }
  judgingConsent: {
    scoringConsent: boolean
    awardsConsent: boolean
    timestamp: string
  }
  mediaConsent?: {
    accepted: boolean
    timestamp: string
  }
  dataUseConsent?: {
    accepted: boolean
    timestamp: string
  }
  publicListingConsent?: {  // CRO: Chambers love this
    accepted: boolean
    timestamp: string
  }
  
  // Compliance tracking
  complianceCompleted: boolean
  complianceCompletedAt: string
}

// ============================================================================
// FLOATS METADATA - TypeScript type for floats metadata structure
// ============================================================================
export type FloatsMetadata = {
  lemonadeDay?: LemonadeDayMetadata
  status?: "pending-consent" | "registered" | "checked-in" | "judged" | "completed"
  statusHistory?: Array<{
    status: string
    timestamp: string
    updatedBy?: string
  }>
  // LEMONADE DAY: Assigned stand location (coordinator-only assignment)
  // CRITICAL SAFETY: placeId is PRIMARY source of truth, lat/lng are CACHE ONLY
  assignedLocation?: {
    placeId: string  // PRIMARY: Google Place ID (source of truth)
    address: string  // Formatted address from Google Maps
    lat?: number     // CACHE ONLY: Derived from placeId, not authoritative
    lng?: number     // CACHE ONLY: Derived from placeId, not authoritative
    placeName?: string  // e.g., "Downtown Park", "Main Street Corner"
    instructions?: string  // Coordinator notes: "Near the fountain", "Blue tent area"
    assignedBy: string  // Coordinator name/ID
    assignedAt: string  // ISO timestamp
  }
  [key: string]: unknown
}

// ============================================================================
// FLOATS - Float entries
// ============================================================================
export const floats = pgTable("floats", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id")
    .references(() => events.id, { onDelete: "cascade" }),
  floatNumber: integer("float_number"),
  organization: text("organization").notNull(),
  entryName: text("entry_name"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  title: text("title"),
  phone: text("phone"),
  email: text("email"),
  comments: text("comments"),
  entryLength: text("entry_length"),
  floatDescription: text("float_description"),
  typeOfEntry: text("type_of_entry"),
  hasMusic: boolean("has_music").notNull().default(false),
  approved: boolean("approved").notNull().default(false),
  submittedAt: timestamp("submitted_at"),
  metadata: jsonb("metadata").$type<FloatsMetadata>().default({}),
})

// ============================================================================
// SCORES - Score records (one per judge-float combination)
// ============================================================================
export const scores = pgTable(
  "scores",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id")
      .references(() => events.id, { onDelete: "cascade" }), // For filtering
    judgeId: integer("judge_id")
      .notNull()
      .references(() => judges.id, { onDelete: "cascade" }),
    floatId: integer("float_id")
      .notNull()
      .references(() => floats.id, { onDelete: "cascade" }),
    // Legacy columns (nullable for migration period)
    lighting: integer("lighting"),
    theme: integer("theme"),
    traditions: integer("traditions"),
    spirit: integer("spirit"),
    music: integer("music"),
    // Total calculated from score_items
    total: integer("total").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    uniqueJudgeFloat: unique().on(table.judgeId, table.floatId),
  })
)

// ============================================================================
// SCORE_ITEMS - Individual category scores (dynamic categories)
// ============================================================================
export const scoreItems = pgTable(
  "score_items",
  {
    id: serial("id").primaryKey(),
    scoreId: integer("score_id")
      .notNull()
      .references(() => scores.id, { onDelete: "cascade" }),
    eventCategoryId: integer("event_category_id")
      .notNull()
      .references(() => eventCategories.id, { onDelete: "cascade" }),
    value: integer("value"), // NULL = not scored, 0 = N/A selected, >0 = scored
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    uniqueScoreCategory: unique().on(table.scoreId, table.eventCategoryId),
  })
)

// ============================================================================
// JUDGE_SUBMISSIONS - Audit trail for judge submissions
// ============================================================================
export const judgeSubmissions = pgTable(
  "judge_submissions",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    judgeId: integer("judge_id")
      .notNull()
      .references(() => judges.id, { onDelete: "cascade" }),
    submittedAt: timestamp("submitted_at").notNull().defaultNow(),
    ipAddress: text("ip_address"), // Optional, for audit
  },
  (table) => ({
    uniqueEventJudgeSubmission: unique().on(table.eventId, table.judgeId),
  })
)

// ============================================================================
// SETTINGS - Application-wide configuration
// ============================================================================
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

// ============================================================================
// RELATIONS - Drizzle ORM relations
// ============================================================================
export const citiesRelations = relations(cities, ({ many, one }) => ({
  events: many(events),
  cityUsers: many(cityUsers),
  branding: one(cityBranding, {
    fields: [cities.id],
    references: [cityBranding.cityId],
  }),
}))

export const eventsRelations = relations(events, ({ many, one }) => ({
  floats: many(floats),
  categories: many(eventCategories),
  judges: many(judges),
  scores: many(scores),
  judgeSubmissions: many(judgeSubmissions),
  city: one(cities, {
    fields: [events.cityId],
    references: [cities.id],
  }),
  branding: one(eventBranding, {
    fields: [events.id],
    references: [eventBranding.eventId],
  }),
}))

export const eventCategoriesRelations = relations(eventCategories, ({ one, many }) => ({
  event: one(events, {
    fields: [eventCategories.eventId],
    references: [events.id],
  }),
  scoreItems: many(scoreItems),
}))

export const judgesRelations = relations(judges, ({ one, many }) => ({
  event: one(events, {
    fields: [judges.eventId],
    references: [events.id],
  }),
  scores: many(scores),
  submissions: many(judgeSubmissions),
}))

export const floatsRelations = relations(floats, ({ one, many }) => ({
  event: one(events, {
    fields: [floats.eventId],
    references: [events.id],
  }),
  scores: many(scores),
}))

export const scoresRelations = relations(scores, ({ one, many }) => ({
  event: one(events, {
    fields: [scores.eventId],
    references: [events.id],
  }),
  judge: one(judges, {
    fields: [scores.judgeId],
    references: [judges.id],
  }),
  float: one(floats, {
    fields: [scores.floatId],
    references: [floats.id],
  }),
  scoreItems: many(scoreItems),
}))

export const scoreItemsRelations = relations(scoreItems, ({ one }) => ({
  score: one(scores, {
    fields: [scoreItems.scoreId],
    references: [scores.id],
  }),
  eventCategory: one(eventCategories, {
    fields: [scoreItems.eventCategoryId],
    references: [eventCategories.id],
  }),
}))

export const judgeSubmissionsRelations = relations(judgeSubmissions, ({ one }) => ({
  event: one(events, {
    fields: [judgeSubmissions.eventId],
    references: [events.id],
  }),
  judge: one(judges, {
    fields: [judgeSubmissions.judgeId],
    references: [judges.id],
  }),
}))

// ============================================================================
// TYPE EXPORTS - TypeScript types inferred from schema
// ============================================================================
export type Event = typeof events.$inferSelect
export type NewEvent = typeof events.$inferInsert

export type EventCategory = typeof eventCategories.$inferSelect
export type NewEventCategory = typeof eventCategories.$inferInsert

export type Judge = typeof judges.$inferSelect
export type NewJudge = typeof judges.$inferInsert

export type Participant = typeof participants.$inferSelect
export type NewParticipant = typeof participants.$inferInsert

export type Float = typeof floats.$inferSelect
export type NewFloat = typeof floats.$inferInsert

export type Score = typeof scores.$inferSelect
export type NewScore = typeof scores.$inferInsert

export type ScoreItem = typeof scoreItems.$inferSelect
export type NewScoreItem = typeof scoreItems.$inferInsert

export type JudgeSubmission = typeof judgeSubmissions.$inferSelect
export type NewJudgeSubmission = typeof judgeSubmissions.$inferInsert

// ============================================================================
// CITY_USERS - User roles per city
// ============================================================================
export const cityUsers = pgTable(
  "city_users",
  {
    id: serial("id").primaryKey(),
    cityId: integer("city_id")
      .notNull()
      .references(() => cities.id, { onDelete: "cascade" }),
    userEmail: text("user_email").notNull(),
    role: text("role")
      .notNull()
      .$type<"admin" | "coordinator" | "judge">(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    uniqueCityUserRole: unique().on(table.cityId, table.userEmail, table.role),
  })
)

// ============================================================================
// WINNING_CATEGORIES - Track winners per category
// ============================================================================
export const winningCategories = pgTable(
  "winning_categories",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    eventCategoryId: integer("event_category_id")
      .notNull()
      .references(() => eventCategories.id, { onDelete: "cascade" }),
    floatId: integer("float_id")
      .notNull()
      .references(() => floats.id, { onDelete: "cascade" }),
    rank: integer("rank").notNull(), // 1 = first place, 2 = second, etc.
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    uniqueEventCategoryFloat: unique().on(
      table.eventId,
      table.eventCategoryId,
      table.floatId
    ),
    uniqueEventCategoryRank: unique().on(
      table.eventId,
      table.eventCategoryId,
      table.rank
    ),
  })
)

// ============================================================================
// EVENT_DOCUMENTS - Store event-related documents
// ============================================================================
export const eventDocuments = pgTable("event_documents", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  cityId: integer("city_id").references(() => cities.id, {
    onDelete: "set null",
  }),
  documentType: text("document_type")
    .notNull()
    .$type<"map" | "rubric" | "instructions" | "height_limits" | "other">(),
  title: text("title").notNull(),
  filePath: text("file_path"),
  fileUrl: text("file_url"),
  description: text("description"),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

// ============================================================================
// VENDORS - Vendor management
// ============================================================================
export const vendors = pgTable("vendors", {
  id: serial("id").primaryKey(),
  cityId: integer("city_id")
    .notNull()
    .references(() => cities.id, { onDelete: "cascade" }),
  eventId: integer("event_id").references(() => events.id, {
    onDelete: "set null",
  }),
  vendorType: text("vendor_type")
    .notNull()
    .$type<"food" | "band" | "cleanup" | "equipment" | "other">(),
  name: text("name").notNull(),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  description: text("description"),
  cost: text("cost").$type<number>(), // Decimal stored as text in Drizzle
  paymentStatus: text("payment_status")
    .default("pending")
    .$type<"pending" | "paid" | "cancelled">(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

// ============================================================================
// TYPE EXPORTS - Additional types
// ============================================================================
export type City = typeof cities.$inferSelect
export type NewCity = typeof cities.$inferInsert

export type CityUser = typeof cityUsers.$inferSelect
export type NewCityUser = typeof cityUsers.$inferInsert

export type WinningCategory = typeof winningCategories.$inferSelect
export type NewWinningCategory = typeof winningCategories.$inferInsert

export type EventDocument = typeof eventDocuments.$inferSelect
export type NewEventDocument = typeof eventDocuments.$inferInsert

export type Vendor = typeof vendors.$inferSelect
export type NewVendor = typeof vendors.$inferInsert

// ============================================================================
// CITY_BRANDING - City-level branding configuration
// ============================================================================
// Brand Hierarchy: Organization/city identity establishes trust, event identity 
// provides context, sponsor recognition in designated non-disruptive areas.
export const cityBranding = pgTable("city_branding", {
  id: serial("id").primaryKey(),
  cityId: integer("city_id").notNull().references(() => cities.id, { onDelete: "cascade" }),
  logoUrl: text("logo_url"),
  logoDarkUrl: text("logo_dark_url"),
  faviconUrl: text("favicon_url"),
  primaryColor: text("primary_color"),
  secondaryColor: text("secondary_color"),
  accentColor: text("accent_color"),
  customCss: text("custom_css"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

// ============================================================================
// EVENT_BRANDING - Per-event branding configuration
// ============================================================================
export const eventBranding = pgTable("event_branding", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  themePreset: text("theme_preset"), // 'christmas', 'lemonade', 'chili', 'german', 'custom'
  textContrastMode: text("text_contrast_mode").default("auto"), // 'auto', 'high', 'maximum'
  logoUrl: text("logo_url"),
  logoDarkUrl: text("logo_dark_url"),
  faviconUrl: text("favicon_url"),
  primaryColor: text("primary_color"),
  secondaryColor: text("secondary_color"),
  accentColor: text("accent_color"),
  backgroundImageUrl: text("background_image_url"),
  fontFamily: text("font_family"),
  customCss: text("custom_css"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

// ============================================================================
// THEME_PRESETS - Professionally designed, accessibility-tested themes
// ============================================================================
// Theme presets function as professionally designed, accessibility-tested 
// experience foundations that reduce setup time while ensuring visual 
// consistency and outdoor readability.
export const themePresets = pgTable("theme_presets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  colors: jsonb("colors").$type<{
    primary: string
    secondary: string
    accent: string
    background: string
    foreground: string
  }>().notNull(),
  cssVariables: jsonb("css_variables").$type<Record<string, string>>(),
  accessibilityMode: text("accessibility_mode").default("standard"), // 'standard', 'high-contrast', 'outdoor'
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

// ============================================================================
// HELP_CONTENT - Context-aware help content
// ============================================================================
// Help and onboarding features provide just-in-time confidence rather than 
// formal training, enabling judges, volunteers, and coordinators to perform 
// effectively with minimal instruction.
export const helpContent = pgTable("help_content", {
  id: serial("id").primaryKey(),
  role: text("role").notNull(), // 'judge', 'admin', 'coordinator', 'public'
  pageContext: text("page_context").notNull(), // 'login', 'scoring', 'results', 'approval', etc.
  title: text("title").notNull(),
  content: text("content").notNull(),
  videoUrl: text("video_url"),
  displayOrder: integer("display_order").default(0),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

// ============================================================================
// USER_ONBOARDING - Track user onboarding progress
// ============================================================================
export const userOnboarding = pgTable("user_onboarding", {
  id: serial("id").primaryKey(),
  userIdentifier: text("user_identifier").notNull(), // Email or judge ID
  role: text("role").notNull(),
  onboardingCompleted: boolean("onboarding_completed").default(false),
  completedSteps: jsonb("completed_steps").$type<string[]>().default([]),
  lastSeenAt: timestamp("last_seen_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

// ============================================================================
// BRANDING RELATIONS
// ============================================================================
export const cityBrandingRelations = relations(cityBranding, ({ one }) => ({
  city: one(cities, {
    fields: [cityBranding.cityId],
    references: [cities.id],
  }),
}))

export const eventBrandingRelations = relations(eventBranding, ({ one }) => ({
  event: one(events, {
    fields: [eventBranding.eventId],
    references: [events.id],
  }),
}))

// ============================================================================
// BRANDING TYPE EXPORTS
// ============================================================================
export type CityBranding = typeof cityBranding.$inferSelect
export type NewCityBranding = typeof cityBranding.$inferInsert

export type EventBranding = typeof eventBranding.$inferSelect
export type NewEventBranding = typeof eventBranding.$inferInsert

export type ThemePreset = typeof themePresets.$inferSelect
export type NewThemePreset = typeof themePresets.$inferInsert

export type HelpContent = typeof helpContent.$inferSelect
export type NewHelpContent = typeof helpContent.$inferInsert

export type UserOnboarding = typeof userOnboarding.$inferSelect
export type NewUserOnboarding = typeof userOnboarding.$inferInsert