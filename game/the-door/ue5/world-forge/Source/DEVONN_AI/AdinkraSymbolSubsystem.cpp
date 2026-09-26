#include "AdinkraSymbolSubsystem.h"
#include "AdinkraSaveGame.h"
#include "Kismet/GameplayStatics.h"

namespace
{
    const FString AdinkraSaveSlot = TEXT("TheDoor_Adinkra");
    constexpr int32 AdinkraSaveUserIndex = 0;
}

void UAdinkraSymbolSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
    Super::Initialize(Collection);
    RegisterSeedSymbols();
    LoadState();
}

bool UAdinkraSymbolSubsystem::ResolveSymbol(FName SymbolID, FAdinkraSymbolDefinition& OutDefinition) const
{
    if (const FAdinkraSymbolDefinition* Found = Symbols.Find(SymbolID))
    {
        OutDefinition = *Found;
        return true;
    }
    return false;
}

TArray<FAdinkraSymbolDefinition> UAdinkraSymbolSubsystem::GetSymbols() const
{
    TArray<FAdinkraSymbolDefinition> Result;
    Symbols.GenerateValueArray(Result);
    return Result;
}

bool UAdinkraSymbolSubsystem::DiscoverSymbol(FName SymbolID, FName WorldID)
{
    if (!Symbols.Contains(SymbolID))
    {
        return false;
    }

    FAdinkraDiscoveryState& State = Discoveries.FindOrAdd(SymbolID);
    State.SymbolID = SymbolID;
    State.bDiscovered = true;
    State.TimesEncountered++;
    if (!WorldID.IsNone())
    {
        State.WorldIDs.AddUnique(WorldID);
    }

    return SaveState();
}

bool UAdinkraSymbolSubsystem::GetDiscoveryState(FName SymbolID, FAdinkraDiscoveryState& OutState) const
{
    if (const FAdinkraDiscoveryState* Found = Discoveries.Find(SymbolID))
    {
        OutState = *Found;
        return true;
    }
    return false;
}

bool UAdinkraSymbolSubsystem::IsSymbolVisibleAtGnosis(FName SymbolID, int32 Gnosis) const
{
    const FAdinkraSymbolDefinition* Found = Symbols.Find(SymbolID);
    return Found && Gnosis >= Found->GnosisRequired;
}

bool UAdinkraSymbolSubsystem::SaveState()
{
    UAdinkraSaveGame* SaveObject = Cast<UAdinkraSaveGame>(UGameplayStatics::CreateSaveGameObject(UAdinkraSaveGame::StaticClass()));
    if (!SaveObject)
    {
        return false;
    }

    SaveObject->SchemaVersion = 1;
    Discoveries.GenerateValueArray(SaveObject->Discoveries);
    return UGameplayStatics::SaveGameToSlot(SaveObject, AdinkraSaveSlot, AdinkraSaveUserIndex);
}

bool UAdinkraSymbolSubsystem::LoadState()
{
    if (!UGameplayStatics::DoesSaveGameExist(AdinkraSaveSlot, AdinkraSaveUserIndex))
    {
        return true;
    }

    UAdinkraSaveGame* SaveObject = Cast<UAdinkraSaveGame>(UGameplayStatics::LoadGameFromSlot(AdinkraSaveSlot, AdinkraSaveUserIndex));
    if (!SaveObject || SaveObject->SchemaVersion != 1)
    {
        return false;
    }

    Discoveries.Reset();
    for (const FAdinkraDiscoveryState& State : SaveObject->Discoveries)
    {
        if (!State.SymbolID.IsNone() && Symbols.Contains(State.SymbolID))
        {
            Discoveries.Add(State.SymbolID, State);
        }
    }
    return true;
}

TArray<FAdinkraGodEyeAnnotation> UAdinkraSymbolSubsystem::GetAnnotationsForWorld(FName WorldID, int32 Gnosis) const
{
    TArray<FAdinkraGodEyeAnnotation> Result;

    for (const TPair<FName, FAdinkraDiscoveryState>& Pair : Discoveries)
    {
        const FAdinkraDiscoveryState& State = Pair.Value;
        if (!State.bDiscovered || !State.WorldIDs.Contains(WorldID))
        {
            continue;
        }

        const FAdinkraSymbolDefinition* Definition = Symbols.Find(State.SymbolID);
        if (!Definition || Gnosis < Definition->GnosisRequired)
        {
            continue;
        }

        FAdinkraGodEyeAnnotation Annotation;
        Annotation.SymbolID = State.SymbolID;
        Annotation.WorldID = WorldID;
        Annotation.Label = Definition->Name;
        Annotation.CulturalMeaning = Definition->CulturalMeaning;
        Annotation.GnosisRequired = Definition->GnosisRequired;
        Annotation.bDiscovered = true;
        Result.Add(Annotation);
    }

    return Result;
}

void UAdinkraSymbolSubsystem::RegisterSeedSymbols()
{
    const auto Add = [this](const TCHAR* Id, const TCHAR* Name, const TCHAR* Meaning, EAdinkraGameplayRole Role, int32 Gnosis)
    {
        FAdinkraSymbolDefinition D;
        D.SymbolID = FName(Id);
        D.Name = Name;
        D.CulturalMeaning = Meaning;
        D.GameplayRole = Role;
        D.GnosisRequired = Gnosis;
        Symbols.Add(D.SymbolID, D);
    };

    Add(TEXT("ADINKRA_SANKOFA"), TEXT("Sankofa"), TEXT("Return and retrieve what was left behind; learning from the past."), EAdinkraGameplayRole::Memory, 0);
    Add(TEXT("ADINKRA_GYE_NYAME"), TEXT("Gye Nyame"), TEXT("The supremacy and enduring presence of God."), EAdinkraGameplayRole::Destiny, 2);
    Add(TEXT("ADINKRA_DWENNIMMEN"), TEXT("Dwennimmen"), TEXT("Strength joined with humility."), EAdinkraGameplayRole::Courage, 1);
    Add(TEXT("ADINKRA_NKYINKYIM"), TEXT("Nkyinkyim"), TEXT("Adaptability, initiative, and the twists of life's journey."), EAdinkraGameplayRole::Transformation, 2);
    Add(TEXT("ADINKRA_FAWOHODIE"), TEXT("Fawohodie"), TEXT("Independence and freedom."), EAdinkraGameplayRole::Freedom, 3);
    Add(TEXT("ADINKRA_AYA"), TEXT("Aya"), TEXT("Endurance, resourcefulness, and defiance through hardship."), EAdinkraGameplayRole::Resilience, 1);
    Add(TEXT("ADINKRA_ADINKRAHENE"), TEXT("Adinkrahene"), TEXT("Leadership, greatness, and the chief among Adinkra symbols."), EAdinkraGameplayRole::Unity, 4);
    Add(TEXT("ADINKRA_ANANSE_NTONTAN"), TEXT("Ananse Ntontan"), TEXT("Wisdom, creativity, and the complexity of life."), EAdinkraGameplayRole::Wisdom, 3);
}
