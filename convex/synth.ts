import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getPresets = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    
    return await ctx.db
      .query("synthPresets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const savePreset = mutation({
  args: {
    name: v.string(),
    oscillator: v.object({
      type: v.string(),
      frequency: v.number(),
      detune: v.number(),
    }),
    filter: v.object({
      type: v.string(),
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
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Must be logged in to save presets");
    }

    return await ctx.db.insert("synthPresets", {
      ...args,
      userId,
    });
  },
});

export const deletePreset = mutation({
  args: { presetId: v.id("synthPresets") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Must be logged in");
    }

    const preset = await ctx.db.get(args.presetId);
    if (!preset || preset.userId !== userId) {
      throw new Error("Preset not found or unauthorized");
    }

    await ctx.db.delete(args.presetId);
  },
});
