#pragma once

#include "CoreMinimal.h"
#include "DoorWorldTypes.generated.h"

UENUM(BlueprintType)
enum class EDoorWorldBody : uint8
{
    Earth,
    Moon,
    Mars,
    Europa,
    Titan,
    Pluto,
    DoorRealm
};

UENUM(BlueprintType)
enum class EDoorRealityClass : uint8
{
    Present,
    Historical,
    Alternate,
    Planetary,
    Anomaly
};

USTRUCT(BlueprintType)
struct FDoorLocationDefinition
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FName LocationID = NAME_None;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FString DisplayName;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    EDoorWorldBody Body = EDoorWorldBody::Earth;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    double Latitude = 0.0;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    double Longitude = 0.0;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    double AltitudeMeters = 0.0;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    bool bSelectable = true;
};

USTRUCT(BlueprintType)
struct FDoorWorldDefinition
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FName WorldID = NAME_None;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FName DoorID = NAME_None;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FName LocationID = NAME_None;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    EDoorRealityClass RealityClass = EDoorRealityClass::Present;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    int32 EraYear = 2026;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FString UnrealMap;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FString TerrainSource;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FString ImagerySource;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FString VectorSource;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    bool bOfflineAvailable = false;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    bool bRequiresOnlineGeodata = false;
};
