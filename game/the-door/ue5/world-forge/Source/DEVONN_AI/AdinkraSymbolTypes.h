#pragma once

#include "CoreMinimal.h"
#include "AdinkraSymbolTypes.generated.h"

UENUM(BlueprintType)
enum class EAdinkraGameplayRole : uint8
{
    Memory,
    Protection,
    Wisdom,
    Courage,
    Transformation,
    Freedom,
    Unity,
    Destiny,
    Resilience,
    Knowledge
};

USTRUCT(BlueprintType)
struct FAdinkraSymbolDefinition
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FName SymbolID = NAME_None;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FString Name;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FString CulturalMeaning;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    EAdinkraGameplayRole GameplayRole = EAdinkraGameplayRole::Knowledge;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    int32 GnosisRequired = 0;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    bool bCanMarkDoor = true;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    bool bCanAppearOutsideGhana = true;
};

USTRUCT(BlueprintType)
struct FAdinkraDiscoveryState
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FName SymbolID = NAME_None;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    bool bDiscovered = false;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    int32 TimesEncountered = 0;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    TArray<FName> WorldIDs;
};
