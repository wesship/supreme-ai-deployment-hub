#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "AdinkraSymbolTypes.h"
#include "AdinkraSymbolSubsystem.generated.h"

UCLASS()
class DEVONN_AI_API UAdinkraSymbolSubsystem : public UGameInstanceSubsystem
{
    GENERATED_BODY()

public:
    virtual void Initialize(FSubsystemCollectionBase& Collection) override;

    UFUNCTION(BlueprintCallable, Category="The Door|Adinkra")
    bool ResolveSymbol(FName SymbolID, FAdinkraSymbolDefinition& OutDefinition) const;

    UFUNCTION(BlueprintCallable, Category="The Door|Adinkra")
    TArray<FAdinkraSymbolDefinition> GetSymbols() const;

    UFUNCTION(BlueprintCallable, Category="The Door|Adinkra")
    bool DiscoverSymbol(FName SymbolID, FName WorldID);

    UFUNCTION(BlueprintCallable, Category="The Door|Adinkra")
    bool GetDiscoveryState(FName SymbolID, FAdinkraDiscoveryState& OutState) const;

    UFUNCTION(BlueprintCallable, Category="The Door|Adinkra")
    bool IsSymbolVisibleAtGnosis(FName SymbolID, int32 Gnosis) const;

    UFUNCTION(BlueprintCallable, Category="The Door|Adinkra")
    bool SaveState();

    UFUNCTION(BlueprintCallable, Category="The Door|Adinkra")
    bool LoadState();

    UFUNCTION(BlueprintCallable, Category="The Door|GodEye")
    TArray<FAdinkraGodEyeAnnotation> GetAnnotationsForWorld(FName WorldID, int32 Gnosis) const;

private:
    void RegisterSeedSymbols();

    UPROPERTY()
    TMap<FName, FAdinkraSymbolDefinition> Symbols;

    UPROPERTY()
    TMap<FName, FAdinkraDiscoveryState> Discoveries;
};
