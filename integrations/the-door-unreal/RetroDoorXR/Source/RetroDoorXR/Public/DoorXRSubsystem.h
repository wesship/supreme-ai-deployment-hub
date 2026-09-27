#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "Interfaces/IHttpRequest.h"
#include "Interfaces/IHttpResponse.h"
#include "DoorXRTypes.h"
#include "DoorXRSubsystem.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(
    FDoorXRNormalized,
    const FDoorXRInteractionResult&,
    Result
);

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(
    FDoorXRAuthorizationRequired,
    const FDoorXRInteraction&,
    Interaction,
    const FDoorXRInteractionResult&,
    BackendResult
);

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(
    FDoorXRRequestFailed,
    const FString&,
    Reason
);

UCLASS()
class RETRODOORXR_API UDoorXRSubsystem : public UGameInstanceSubsystem
{
    GENERATED_BODY()

public:
    UPROPERTY(BlueprintAssignable)
    FDoorXRNormalized OnInteractionNormalized;

    UPROPERTY(BlueprintAssignable)
    FDoorXRAuthorizationRequired OnDoorAuthorizationRequired;

    UPROPERTY(BlueprintAssignable)
    FDoorXRRequestFailed OnRequestFailed;

    UFUNCTION(BlueprintCallable, Category="THE DOOR|XR")
    void ConfigureEndpoint(const FString& InApiBaseUrl, const FString& InBearerToken);

    UFUNCTION(BlueprintCallable, Category="THE DOOR|XR")
    void SetMetaRuntimeReady(bool bReady);

    UFUNCTION(BlueprintCallable, Category="THE DOOR|XR")
    void SubmitInteraction(const FDoorXRInteraction& Interaction);

private:
    bool bMetaRuntimeReady = false;
    FString ApiBaseUrl = TEXT("https://api.d3vonn.io");
    FString BearerToken;

    FString ProviderToString(EDoorXRProvider Provider) const;
    FString InputKindToString(EDoorXRInputKind Kind) const;

    void HandleResponse(
        FHttpRequestPtr Request,
        FHttpResponsePtr Response,
        bool bWasSuccessful,
        FDoorXRInteraction OriginalInteraction
    );
};
