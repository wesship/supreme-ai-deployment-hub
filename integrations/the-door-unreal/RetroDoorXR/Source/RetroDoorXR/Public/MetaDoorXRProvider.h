#pragma once

#include "CoreMinimal.h"
#include "DoorXRProvider.h"

class FMetaDoorXRProvider final : public IDoorXRProvider
{
public:
    explicit FMetaDoorXRProvider(bool bInRuntimeReady = false)
        : bRuntimeReady(bInRuntimeReady)
    {
    }

    virtual EDoorXRProvider GetProvider() const override
    {
        return EDoorXRProvider::Meta;
    }

    virtual bool IsRuntimeReady() const override
    {
        return bRuntimeReady;
    }

    void SetRuntimeReady(bool bReady)
    {
        bRuntimeReady = bReady;
    }

    virtual FDoorXRInteraction NormalizeInteraction(
        const FDoorXRInteraction& RawInteraction) const override
    {
        FDoorXRInteraction Normalized = RawInteraction;
        Normalized.Provider = EDoorXRProvider::Meta;
        return Normalized;
    }

private:
    bool bRuntimeReady = false;
};
