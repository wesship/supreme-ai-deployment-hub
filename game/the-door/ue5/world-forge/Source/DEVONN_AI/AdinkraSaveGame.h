#pragma once

#include "CoreMinimal.h"
#include "GameFramework/SaveGame.h"
#include "AdinkraSymbolTypes.h"
#include "AdinkraSaveGame.generated.h"

UCLASS()
class DEVONN_AI_API UAdinkraSaveGame : public USaveGame
{
    GENERATED_BODY()

public:
    UPROPERTY(SaveGame)
    int32 SchemaVersion = 1;

    UPROPERTY(SaveGame)
    TArray<FAdinkraDiscoveryState> Discoveries;
};
