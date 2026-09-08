import {
  Activity, Ambulance, BadgeIndianRupee, Bike, Bot, Box, Boxes, Brain, Building2, Bus, BusFront,
  Cpu, Droplet, Droplets, Factory, FireExtinguisher, Flame, Footprints, Fuel, Gauge, GitBranch,
  GraduationCap, Handshake, HardHat, HeartPulse, Hospital, Landmark, Leaf, Lightbulb, Milestone,
  Mountain, PhoneCall, Pickaxe, Plane, Radio, Recycle, Rocket, Route, Satellite, Shield,
  ShieldCheck, Ship, Siren, Snowflake, Sparkles, Sprout, SquareParking, Sun, Tent, Ticket,
  TrafficCone, TrainFront, Trees, Trophy, Waves, Wind, Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/** Curated icon map: mission data references icons by lucide name. */
const ICONS: Record<string, LucideIcon> = {
  Activity, Ambulance, BadgeIndianRupee, Bike, Bot, Box, Boxes, Brain, Building2, Bus, BusFront,
  Cpu, Droplet, Droplets, Factory, FireExtinguisher, Flame, Footprints, Fuel, Gauge, GitBranch,
  GraduationCap, Handshake, HardHat, HeartPulse, Hospital, Landmark, Leaf, Lightbulb, Milestone,
  Mountain, PhoneCall, Pickaxe, Plane, Radio, Recycle, Rocket, Route, Satellite, Shield,
  ShieldCheck, Ship, Siren, Snowflake, Sparkles, Sprout, SquareParking, Sun, Tent, Ticket,
  TrafficCone, TrainFront, Trees, Trophy, Waves, Wind, Zap,
};

export function getIcon(name: string): LucideIcon {
  return ICONS[name] ?? Activity;
}
