#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "DoorWorldTypes.h"
#include "GeoLibreWorldForgeSubsystem.generated.h"

UCLASS()
class DEVONN_AI_API UGeoLibreWorldForgeSubsystem : public UGameInstanceSubsystem
{
    GENERATED_BODY()

public:
    UFUNCTION(BlueprintCallable, Category="The Door|WorldForge")
    bool BuildWorldDefinition(const FDoorLocationDefinition& Location, int32 EraYear, EDoorRealityClass RealityClass, FDoorWorldDefinition& OutWorld) const;

    UFUNCTION(BlueprintCallable, Category="The Door|WorldForge")
    bool BuildSelectedWorld(FName LocationID, int32 EraYear, EDoorRealityClass RealityClass, FDoorWorldDefinition& OutWorld) const;

private:
    static FString MakeMapPath(FName LocationID, EDoorRealityClass RealityClass, int32 EraYear);
    static FString BodyName(EDoorWorldBody Body);
};
