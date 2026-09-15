#include "GodEyeLocationSubsystem.h"

void UGodEyeLocationSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
    Super::Initialize(Collection);
    RegisterSeedLocations();
}

bool UGodEyeLocationSubsystem::RegisterLocation(const FDoorLocationDefinition& Definition)
{
    if (Definition.LocationID.IsNone())
    {
        return false;
    }
    Locations.Add(Definition.LocationID, Definition);
    return true;
}

bool UGodEyeLocationSubsystem::ResolveLocation(FName LocationID, FDoorLocationDefinition& OutDefinition) const
{
    if (const FDoorLocationDefinition* Found = Locations.Find(LocationID))
    {
        OutDefinition = *Found;
        return true;
    }
    return false;
}

bool UGodEyeLocationSubsystem::SelectLocation(FName LocationID)
{
    const FDoorLocationDefinition* Found = Locations.Find(LocationID);
    if (!Found || !Found->bSelectable)
    {
        return false;
    }

    SelectedLocationID = LocationID;
    OnLocationSelected.Broadcast(LocationID);
    return true;
}

TArray<FDoorLocationDefinition> UGodEyeLocationSubsystem::GetLocations() const
{
    TArray<FDoorLocationDefinition> Result;
    Locations.GenerateValueArray(Result);
    return Result;
}

void UGodEyeLocationSubsystem::RegisterSeedLocations()
{
    const auto Add = [this](const TCHAR* Id, const TCHAR* Name, EDoorWorldBody Body, double Lat, double Lon, double Alt)
    {
        FDoorLocationDefinition D;
        D.LocationID = FName(Id);
        D.DisplayName = Name;
        D.Body = Body;
        D.Latitude = Lat;
        D.Longitude = Lon;
        D.AltitudeMeters = Alt;
        RegisterLocation(D);
    };

    Add(TEXT("LOC_NYC_001"), TEXT("New York City"), EDoorWorldBody::Earth, 40.7128, -74.0060, 10.0);
    Add(TEXT("LOC_PHL_001"), TEXT("Philadelphia"), EDoorWorldBody::Earth, 39.9526, -75.1652, 12.0);
    Add(TEXT("LOC_DEN_001"), TEXT("Denver"), EDoorWorldBody::Earth, 39.7392, -104.9903, 1609.0);
    Add(TEXT("LOC_ACC_001"), TEXT("Accra, Ghana"), EDoorWorldBody::Earth, 5.6037, -0.1870, 61.0);
    Add(TEXT("LOC_DXB_001"), TEXT("Dubai, UAE"), EDoorWorldBody::Earth, 25.2048, 55.2708, 16.0);
    Add(TEXT("LOC_MOON_TRANQUILITY_001"), TEXT("Moon — Tranquility Region"), EDoorWorldBody::Moon, 0.6741, 23.4729, 0.0);
    Add(TEXT("LOC_MARS_VALLES_001"), TEXT("Mars — Valles Marineris"), EDoorWorldBody::Mars, -14.0, -59.0, 0.0);
    Add(TEXT("LOC_EUROPA_001"), TEXT("Europa — Door Site"), EDoorWorldBody::Europa, 0.0, 0.0, 0.0);
    Add(TEXT("LOC_DOOR_REALM_001"), TEXT("Door Realm Anomaly"), EDoorWorldBody::DoorRealm, 0.0, 0.0, 0.0);
}
