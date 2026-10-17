#include "AdinkraEncounterActor.h"
#include "AdinkraSymbolSubsystem.h"
#include "Engine/GameInstance.h"
#include "Engine/World.h"

AAdinkraEncounterActor::AAdinkraEncounterActor()
{
    PrimaryActorTick.bCanEverTick = false;
}

bool AAdinkraEncounterActor::CanInteract(int32 CurrentGnosis, FAdinkraSymbolDefinition& OutDefinition) const
{
    const UWorld* World = GetWorld();
    if (!World)
    {
        return false;
    }

    const UGameInstance* GameInstance = World->GetGameInstance();
    if (!GameInstance)
    {
        return false;
    }

    const UAdinkraSymbolSubsystem* Symbols = GameInstance->GetSubsystem<UAdinkraSymbolSubsystem>();
    if (!Symbols || !Symbols->ResolveSymbol(SymbolID, OutDefinition))
    {
        return false;
    }

    const int32 RequiredGnosis = RequiredGnosisOverride >= 0 ? RequiredGnosisOverride : OutDefinition.GnosisRequired;
    return CurrentGnosis >= RequiredGnosis;
}

bool AAdinkraEncounterActor::Interact(int32 CurrentGnosis, FAdinkraSymbolDefinition& OutDefinition)
{
    if (!CanInteract(CurrentGnosis, OutDefinition))
    {
        return false;
    }

    UWorld* World = GetWorld();
    UGameInstance* GameInstance = World ? World->GetGameInstance() : nullptr;
    UAdinkraSymbolSubsystem* Symbols = GameInstance ? GameInstance->GetSubsystem<UAdinkraSymbolSubsystem>() : nullptr;
    if (!Symbols)
    {
        return false;
    }

    bool bDiscoveredNow = false;
    if (bDiscoverOnInteract)
    {
        FAdinkraDiscoveryState Existing;
        const bool bWasDiscovered = Symbols->GetDiscoveryState(SymbolID, Existing) && Existing.bDiscovered;
        if (!Symbols->DiscoverSymbol(SymbolID, WorldID))
        {
            return false;
        }
        bDiscoveredNow = !bWasDiscovered;
    }

    OnEncounterResolved.Broadcast(SymbolID, bDiscoveredNow);
    return true;
}

FString AAdinkraEncounterActor::GetInteractionLabel() const
{
    return SymbolID.IsNone()
        ? TEXT("Inspect symbol")
        : FString::Printf(TEXT("Inspect %s"), *SymbolID.ToString());
}
