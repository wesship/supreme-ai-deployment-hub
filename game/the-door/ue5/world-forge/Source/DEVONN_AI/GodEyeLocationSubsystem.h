#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "DoorWorldTypes.h"
#include "GodEyeLocationSubsystem.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FGodEyeLocationSelected, FName, LocationID);

UCLASS()
class DEVONN_AI_API UGodEyeLocationSubsystem : public UGameInstanceSubsystem
{
    GENERATED_BODY()

public:
    virtual void Initialize(FSubsystemCollectionBase& Collection) override;

    UFUNCTION(BlueprintCallable, Category="The Door|GodEye")
    bool RegisterLocation(const FDoorLocationDefinition& Definition);

    UFUNCTION(BlueprintCallable, Category="The Door|GodEye")
    bool ResolveLocation(FName LocationID, FDoorLocationDefinition& OutDefinition) const;

    UFUNCTION(BlueprintCallable, Category="The Door|GodEye")
    bool SelectLocation(FName LocationID);

    UFUNCTION(BlueprintPure, Category="The Door|GodEye")
    FName GetSelectedLocationID() const { return SelectedLocationID; }

    UFUNCTION(BlueprintCallable, Category="The Door|GodEye")
    TArray<FDoorLocationDefinition> GetLocations() const;

    UPROPERTY(BlueprintAssignable, Category="The Door|GodEye")
    FGodEyeLocationSelected OnLocationSelected;

private:
    void RegisterSeedLocations();

    UPROPERTY()
    TMap<FName, FDoorLocationDefinition> Locations;

    UPROPERTY()
    FName SelectedLocationID = NAME_None;
};
