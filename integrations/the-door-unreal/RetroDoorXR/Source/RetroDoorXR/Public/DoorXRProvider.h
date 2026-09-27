#pragma once

#include "CoreMinimal.h"
#include "DoorXRTypes.h"

class IDoorXRProvider
{
public:
    virtual ~IDoorXRProvider() = default;

    virtual EDoorXRProvider GetProvider() const = 0;
    virtual bool IsRuntimeReady() const = 0;

    // Providers normalize device-specific input only. They must not load levels,
    // mutate saves, advance missions, or authorize Door entry.
    virtual FDoorXRInteraction NormalizeInteraction(
        const FDoorXRInteraction& RawInteraction) const = 0;
};
