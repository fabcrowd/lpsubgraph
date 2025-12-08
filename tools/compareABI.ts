// Tool to compare current ABI with fetched ABI
import * as fs from "fs";
import * as path from "path";

const CURRENT_ABI_PATH = path.join(__dirname, "../abis/PositionRegistry.json");
const NEW_ABI_PATH = process.argv[2];

if (!NEW_ABI_PATH) {
  console.log("Usage: tsx tools/compareABI.ts <path-to-new-abi.json>");
  console.log("\nExample:");
  console.log("  1. Copy ABI from Basescan to new-abi.json");
  console.log("  2. Run: tsx tools/compareABI.ts new-abi.json");
  process.exit(1);
}

try {
  const currentABI = JSON.parse(fs.readFileSync(CURRENT_ABI_PATH, "utf-8"));
  const newABI = JSON.parse(fs.readFileSync(NEW_ABI_PATH, "utf-8"));

  console.log("🔍 Comparing ABIs...\n");

  // Extract events
  const currentEvents = currentABI.filter((item: any) => item.type === "event");
  const newEvents = newABI.filter((item: any) => item.type === "event");

  console.log(`Current ABI has ${currentEvents.length} events`);
  console.log(`New ABI has ${newEvents.length} events\n`);

  // Find events we care about
  const importantEvents = ["Checkpoint", "Subscribe", "Unsubscribe", "RewardsAdded", "RewardsClaimed"];

  console.log("=".repeat(80));
  console.log("EVENT COMPARISON");
  console.log("=".repeat(80));

  for (const eventName of importantEvents) {
    const currentEvent = currentEvents.find((e: any) => e.name === eventName);
    const newEvent = newEvents.find((e: any) => e.name === eventName);

    console.log(`\n📋 ${eventName}:`);
    
    if (!currentEvent && !newEvent) {
      console.log("   ⚠️  Not found in either ABI");
    } else if (!currentEvent) {
      console.log("   ✅ Found in new ABI (NEW)");
      console.log(`   Parameters: ${newEvent.inputs.map((i: any) => `${i.indexed ? 'indexed ' : ''}${i.type} ${i.name}`).join(", ")}`);
    } else if (!newEvent) {
      console.log("   ⚠️  Found in current ABI but not in new ABI");
    } else {
      // Compare signatures
      const currentSig = currentEvent.inputs.map((i: any) => `${i.indexed ? 'indexed ' : ''}${i.type}`).join(",");
      const newSig = newEvent.inputs.map((i: any) => `${i.indexed ? 'indexed ' : ''}${i.type}`).join(",");
      
      if (currentSig === newSig) {
        console.log("   ✅ Signatures match");
      } else {
        console.log("   ⚠️  Signatures differ!");
        console.log(`   Current: ${eventName}(${currentSig})`);
        console.log(`   New:     ${eventName}(${newSig})`);
      }

      // Compare parameter names
      const currentParams = currentEvent.inputs.map((i: any) => i.name).join(", ");
      const newParams = newEvent.inputs.map((i: any) => i.name).join(", ");
      
      if (currentParams !== newParams) {
        console.log(`   ⚠️  Parameter names differ:`);
        console.log(`   Current: ${currentParams}`);
        console.log(`   New:     ${newParams}`);
      }
    }
  }

  // Check for unexpected events in new ABI
  console.log("\n" + "=".repeat(80));
  console.log("ADDITIONAL EVENTS IN NEW ABI");
  console.log("=".repeat(80));
  
  const newEventNames = newEvents.map((e: any) => e.name);
  const currentEventNames = currentEvents.map((e: any) => e.name);
  const additionalEvents = newEventNames.filter((name: string) => !currentEventNames.includes(name));
  
  if (additionalEvents.length > 0) {
    additionalEvents.forEach((name: string) => {
      const event = newEvents.find((e: any) => e.name === name);
      console.log(`\n➕ ${name}:`);
      console.log(`   ${event.inputs.map((i: any) => `${i.indexed ? 'indexed ' : ''}${i.type} ${i.name}`).join(", ")}`);
    });
  } else {
    console.log("\n✅ No additional events found");
  }

  // Recommendation
  console.log("\n" + "=".repeat(80));
  console.log("RECOMMENDATION");
  console.log("=".repeat(80));
  
  const hasDifferences = currentEvents.some((ce: any) => {
    const ne = newEvents.find((e: any) => e.name === ce.name);
    if (!ne) return true;
    const currentSig = ce.inputs.map((i: any) => `${i.indexed ? 'indexed ' : ''}${i.type}`).join(",");
    const newSig = ne.inputs.map((i: any) => `${i.indexed ? 'indexed ' : ''}${i.type}`).join(",");
    return currentSig !== newSig;
  });

  if (hasDifferences) {
    console.log("\n⚠️  Differences found! You should:");
    console.log("  1. Replace abis/PositionRegistry.json with the new ABI");
    console.log("  2. Run: npm run codegen");
    console.log("  3. Update event handlers in subgraph.yaml if signatures changed");
    console.log("  4. Update handlers in src/registryMapping.ts if parameter names changed");
    console.log("  5. Run: npm run build");
  } else {
    console.log("\n✅ ABIs match! No changes needed.");
  }

} catch (error) {
  console.error("Error comparing ABIs:", error);
  process.exit(1);
}

