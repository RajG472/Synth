import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  synthPresets: defineTable({
    name: v.string(),
    userId: v.id("users"),
    oscillator: v.object({
      type: v.string(), // "sine", "square", "sawtooth", "triangle"
      frequency: v.number(),
      detune: v.number(),
    }),
    filter: v.object({
      type: v.string(), // "lowpass", "highpass", "bandpass"
      frequency: v.number(),
      Q: v.number(),
    }),
    envelope: v.object({
      attack: v.number(),
      decay: v.number(),
      sustain: v.number(),
      release: v.number(),
    }),
    effects: v.object({
      reverb: v.number(),
      delay: v.number(),
      distortion: v.number(),
    }),
    volume: v.number(),
  }).index("by_user", ["userId"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
