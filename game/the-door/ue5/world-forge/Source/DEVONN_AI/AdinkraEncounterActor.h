#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "AdinkraSymbolTypes.h"
#include "AdinkraEncounterActor.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnAdinkraEncounterResolved, FName, SymbolID, bool, bDiscoveredNow);

UCLASS(BlueprintType, Blueprintable)
class DEVONN_AI_API AAdinkraEncounterActor : public AActor
{
    GENERATED_BODY()

public:
    AAdinkraEncounterActor();

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="The Door|Adinkra")
    FName SymbolID = TEXT("ADINKRA_SANKOFA");

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="The Door|Adinkra")
    FName WorldID = NAME_None;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="The Door|Adinkra")
    int32 RequiredGnosisOverride = -1;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="The Door|Adinkra")
    bool bDiscoverOnInteract = true;

    UPROPERTY(BlueprintAssignable, Category="The Door|Adinkra")
    FOnAdinkraEncounterResolved OnEncounterResolved;

    UFUNCTION(BlueprintCallable, Category="The Door|Adinkra")
    bool CanInteract(int32 CurrentGnosis, FAdinkraSymbolDefinition& OutDefinition) const;

    UFUNCTION(BlueprintCallable, Category="The Door|Adinkra")
    bool Interact(int32 CurrentGnosis, FAdinkraSymbolDefinition& OutDefinition);

    UFUNCTION(BlueprintPure, Category="The Door|Adinkra")
    FString GetInteractionLabel() const;
};
