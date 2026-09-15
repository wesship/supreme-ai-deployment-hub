#include "AdinkraSymbolSubsystem.h"

void UAdinkraSymbolSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
    Super::Initialize(Collection);
    RegisterSeedSymbols();
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
    return true;
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
