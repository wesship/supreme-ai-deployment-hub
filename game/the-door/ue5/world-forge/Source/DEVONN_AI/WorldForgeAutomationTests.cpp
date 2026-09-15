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
