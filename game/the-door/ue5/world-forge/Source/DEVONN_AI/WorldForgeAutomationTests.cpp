#include "Misc/AutomationTest.h"
#include "GeoLibreWorldForgeSubsystem.h"

#if WITH_DEV_AUTOMATION_TESTS

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
    FWorldForgeBuildDefinitionTest,
    "TheDoor.WorldForge.BuildDefinition",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FWorldForgeBuildDefinitionTest::RunTest(const FString& Parameters)
{
    FDoorLocationDefinition Location;
    Location.LocationID = TEXT("LOC_NYC_001");
    Location.DisplayName = TEXT("New York City");
    Location.Body = EDoorWorldBody::Earth;
    Location.Latitude = 40.7128;
    Location.Longitude = -74.0060;

    UGeoLibreWorldForgeSubsystem* Forge = NewObject<UGeoLibreWorldForgeSubsystem>();
    TestNotNull(TEXT("World Forge subsystem object"), Forge);
    if (!Forge)
    {
        return false;
    }

    FDoorWorldDefinition World;
    TestTrue(TEXT("Build world definition"), Forge->BuildWorldDefinition(Location, 1977, EDoorRealityClass::Historical, World));
    TestEqual(TEXT("Location identity preserved"), World.LocationID, Location.LocationID);
    TestEqual(TEXT("Era preserved"), World.EraYear, 1977);
    TestEqual(TEXT("Reality class preserved"), World.RealityClass, EDoorRealityClass::Historical);
    TestFalse(TEXT("External geodata world is not falsely certified offline"), World.bOfflineAvailable);
    TestTrue(TEXT("External geodata is explicitly marked online-required until cooked"), World.bRequiresOnlineGeodata);
    TestTrue(TEXT("Map path generated"), !World.UnrealMap.IsEmpty());

    FDoorLocationDefinition Giza;
    Giza.LocationID = TEXT("LOC_GIZA_001");
    Giza.DisplayName = TEXT("Giza Plateau");
    Giza.Body = EDoorWorldBody::Earth;
    Giza.Latitude = 29.9792;
    Giza.Longitude = 31.1342;

    FDoorWorldDefinition GizaHistorical;
    TestTrue(TEXT("Build Ancient Threshold historical world"), Forge->BuildWorldDefinition(Giza, -2550, EDoorRealityClass::Historical, GizaHistorical));
    TestEqual(TEXT("Ancient Threshold location preserved"), GizaHistorical.LocationID, Giza.LocationID);
    TestEqual(TEXT("Ancient Threshold era preserved"), GizaHistorical.EraYear, -2550);
    TestEqual(TEXT("Ancient Threshold historical class preserved"), GizaHistorical.RealityClass, EDoorRealityClass::Historical);

    FDoorWorldDefinition GizaAnomaly;
    TestTrue(TEXT("Build Ancient Threshold anomaly world"), Forge->BuildWorldDefinition(Giza, 2026, EDoorRealityClass::Anomaly, GizaAnomaly));
    TestEqual(TEXT("Same location can branch into a second reality"), GizaAnomaly.LocationID, Giza.LocationID);
    TestTrue(TEXT("Historical and anomaly map paths diverge"), GizaHistorical.UnrealMap != GizaAnomaly.UnrealMap);

    FDoorLocationDefinition Realm;
    Realm.LocationID = TEXT("LOC_DOOR_REALM_001");
    Realm.Body = EDoorWorldBody::DoorRealm;

    FDoorWorldDefinition RealmWorld;
    TestTrue(TEXT("Build Door Realm definition"), Forge->BuildWorldDefinition(Realm, 2026, EDoorRealityClass::Anomaly, RealmWorld));
    TestTrue(TEXT("Door Realm can be local/offline"), RealmWorld.bOfflineAvailable);
    TestFalse(TEXT("Door Realm does not require online geodata"), RealmWorld.bRequiresOnlineGeodata);

    return true;
}

#endif
