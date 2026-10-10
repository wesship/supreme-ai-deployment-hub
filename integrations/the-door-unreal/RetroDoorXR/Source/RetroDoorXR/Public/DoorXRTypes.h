#pragma once

#include "CoreMinimal.h"
#include "DoorXRTypes.generated.h"

UENUM(BlueprintType)
enum class EDoorXRProvider : uint8
{
    Meta,
    OpenXR,
    Xreal,
    WebXR,
    Desktop,
    Mobile
};

UENUM(BlueprintType)
enum class EDoorXRInputKind : uint8
{
    Gaze,
    Hand,
    Controller,
    Voice,
    SpatialAnchor
};

USTRUCT(BlueprintType)
struct FDoorXRInteraction
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FString ProjectId;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    EDoorXRProvider Provider = EDoorXRProvider::Meta;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    EDoorXRInputKind InputKind = EDoorXRInputKind::Gaze;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FString Action;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FString TargetId;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FString SessionId;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FString SpatialAnchorId;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    TMap<FString, FString> Payload;
};

USTRUCT(BlueprintType)
struct FDoorXRInteractionResult
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly)
    bool bAccepted = false;

    UPROPERTY(BlueprintReadOnly)
    bool bAuthoritative = false;

    UPROPERTY(BlueprintReadOnly)
    FString NextStep;

    UPROPERTY(BlueprintReadOnly)
    FString Reason;

    UPROPERTY(BlueprintReadOnly)
    FString TargetId;
};
