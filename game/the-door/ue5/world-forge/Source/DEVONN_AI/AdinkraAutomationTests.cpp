#include "Misc/AutomationTest.h"
#include "AdinkraSymbolTypes.h"

#if WITH_DEV_AUTOMATION_TESTS

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
    FAdinkraNarrativeContractTest,
    "TheDoor.WorldForge.Adinkra.NarrativeContract",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FAdinkraNarrativeContractTest::RunTest(const FString& Parameters)
{
    FAdinkraSymbolDefinition Symbol;
    Symbol.SymbolID = TEXT("ADINKRA_SANKOFA");
    Symbol.Name = TEXT("Sankofa");
    Symbol.CulturalMeaning = TEXT("Learning from the past and retrieving what should not be forgotten.");
    Symbol.GameplayRole = EAdinkraGameplayRole::Memory;
    Symbol.GnosisRequired = 0;

    TestEqual(TEXT("Stable Adinkra symbol identity"), Symbol.SymbolID, FName(TEXT("ADINKRA_SANKOFA")));
    TestEqual(TEXT("Narrative role remains explicit"), Symbol.GameplayRole, EAdinkraGameplayRole::Memory);
    TestTrue(TEXT("Cultural meaning remains recorded separately from gameplay role"), !Symbol.CulturalMeaning.IsEmpty());

    FAdinkraDiscoveryState Discovery;
    Discovery.SymbolID = Symbol.SymbolID;
    Discovery.bDiscovered = true;
    Discovery.TimesEncountered = 2;
    Discovery.WorldIDs.Add(TEXT("WORLD_ACC_2026"));
    Discovery.WorldIDs.Add(TEXT("WORLD_NYC_2026"));

    TestEqual(TEXT("Discovery can span worlds"), Discovery.WorldIDs.Num(), 2);
    return true;
}

#endif
