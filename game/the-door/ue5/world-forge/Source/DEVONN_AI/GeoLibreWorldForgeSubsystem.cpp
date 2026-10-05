#include "GeoLibreWorldForgeSubsystem.h"
#include "GodEyeLocationSubsystem.h"
#include "Engine/GameInstance.h"

bool UGeoLibreWorldForgeSubsystem::BuildWorldDefinition(const FDoorLocationDefinition& Location, int32 EraYear, EDoorRealityClass RealityClass, FDoorWorldDefinition& OutWorld) const
{
    if (Location.LocationID.IsNone())
    {
        return false;
    }

    const FString LocationToken = Location.LocationID.ToString();
    const FString Body = BodyName(Location.Body);

    OutWorld.WorldID = FName(*FString::Printf(TEXT("WORLD_%s_%d"), *LocationToken, EraYear));
    OutWorld.DoorID = FName(*FString::Printf(TEXT("DOOR_%s_%d"), *LocationToken, EraYear));
    OutWorld.LocationID = Location.LocationID;
    OutWorld.RealityClass = RealityClass;
    OutWorld.EraYear = EraYear;
    OutWorld.UnrealMap = MakeMapPath(Location.LocationID, RealityClass, EraYear);

    // These are manifest identifiers, not bundled provider data. Import/cook pipelines
    // must resolve licensed datasets separately before a world is marked offline-ready.
    OutWorld.TerrainSource = FString::Printf(TEXT("geolibre://%s/%s/terrain"), *Body, *LocationToken);
    OutWorld.ImagerySource = FString::Printf(TEXT("geolibre://%s/%s/imagery"), *Body, *LocationToken);
    OutWorld.VectorSource = FString::Printf(TEXT("geolibre://%s/%s/vector"), *Body, *LocationToken);

    const bool bDoorRealm = Location.Body == EDoorWorldBody::DoorRealm;
    OutWorld.bOfflineAvailable = bDoorRealm;
    OutWorld.bRequiresOnlineGeodata = !bDoorRealm;

    return true;
}

bool UGeoLibreWorldForgeSubsystem::BuildSelectedWorld(FName LocationID, int32 EraYear, EDoorRealityClass RealityClass, FDoorWorldDefinition& OutWorld) const
{
    const UGameInstance* GI = GetGameInstance();
    if (!GI)
    {
        return false;
    }

    const UGodEyeLocationSubsystem* GodEye = GI->GetSubsystem<UGodEyeLocationSubsystem>();
    if (!GodEye)
    {
        return false;
    }

    FDoorLocationDefinition Location;
    if (!GodEye->ResolveLocation(LocationID, Location))
    {
        return false;
    }

    return BuildWorldDefinition(Location, EraYear, RealityClass, OutWorld);
}

FString UGeoLibreWorldForgeSubsystem::MakeMapPath(FName LocationID, EDoorRealityClass RealityClass, int32 EraYear)
{
    const UEnum* RealityEnum = StaticEnum<EDoorRealityClass>();
    const FString Reality = RealityEnum ? RealityEnum->GetNameStringByValue(static_cast<int64>(RealityClass)) : TEXT("Unknown");
    return FString::Printf(TEXT("/Game/Worlds/%s/%s_%d"), *LocationID.ToString(), *Reality, EraYear);
}

FString UGeoLibreWorldForgeSubsystem::BodyName(EDoorWorldBody Body)
{
    const UEnum* BodyEnum = StaticEnum<EDoorWorldBody>();
    return BodyEnum ? BodyEnum->GetNameStringByValue(static_cast<int64>(Body)) : TEXT("Unknown");
}
