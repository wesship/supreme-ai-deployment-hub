#include "DoorXRSubsystem.h"

#include "Dom/JsonObject.h"
#include "HttpModule.h"
#include "Interfaces/IHttpResponse.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "Serialization/JsonWriter.h"

void UDoorXRSubsystem::ConfigureEndpoint(
    const FString& InApiBaseUrl,
    const FString& InBearerToken)
{
    ApiBaseUrl = InApiBaseUrl;
    ApiBaseUrl.RemoveFromEnd(TEXT("/"));
    BearerToken = InBearerToken;
}

FString UDoorXRSubsystem::ProviderToString(EDoorXRProvider Provider) const
{
    switch (Provider)
    {
    case EDoorXRProvider::Meta: return TEXT("meta");
    case EDoorXRProvider::OpenXR: return TEXT("openxr");
    case EDoorXRProvider::Xreal: return TEXT("xreal");
    case EDoorXRProvider::WebXR: return TEXT("webxr");
    case EDoorXRProvider::Desktop: return TEXT("desktop");
    case EDoorXRProvider::Mobile: return TEXT("mobile");
    default: return TEXT("meta");
    }
}

FString UDoorXRSubsystem::InputKindToString(EDoorXRInputKind Kind) const
{
    switch (Kind)
    {
    case EDoorXRInputKind::Gaze: return TEXT("gaze");
    case EDoorXRInputKind::Hand: return TEXT("hand");
    case EDoorXRInputKind::Controller: return TEXT("controller");
    case EDoorXRInputKind::Voice: return TEXT("voice");
    case EDoorXRInputKind::SpatialAnchor: return TEXT("spatial_anchor");
    default: return TEXT("gaze");
    }
}

void UDoorXRSubsystem::SubmitInteraction(const FDoorXRInteraction& Interaction)
{
    if (Interaction.ProjectId.IsEmpty() || Interaction.Action.IsEmpty())
    {
        OnRequestFailed.Broadcast(TEXT("ProjectId and Action are required."));
        return;
    }

    TSharedRef<FJsonObject> Root = MakeShared<FJsonObject>();
    Root->SetStringField(TEXT("schema"), TEXT("d3vonn.the-door.xr-interaction/v1"));
    Root->SetStringField(TEXT("project_id"), Interaction.ProjectId);
    Root->SetStringField(TEXT("provider"), ProviderToString(Interaction.Provider));
    Root->SetStringField(TEXT("input_kind"), InputKindToString(Interaction.InputKind));
    Root->SetStringField(TEXT("action"), Interaction.Action);

    if (!Interaction.TargetId.IsEmpty())
    {
        Root->SetStringField(TEXT("target_id"), Interaction.TargetId);
    }
    if (!Interaction.SessionId.IsEmpty())
    {
        Root->SetStringField(TEXT("session_id"), Interaction.SessionId);
    }
    if (!Interaction.SpatialAnchorId.IsEmpty())
    {
        Root->SetStringField(TEXT("spatial_anchor_id"), Interaction.SpatialAnchorId);
    }

    TSharedRef<FJsonObject> Payload = MakeShared<FJsonObject>();
    for (const TPair<FString, FString>& Pair : Interaction.Payload)
    {
        Payload->SetStringField(Pair.Key, Pair.Value);
    }
    Root->SetObjectField(TEXT("payload"), Payload);

    FString Body;
    const TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&Body);
    FJsonSerializer::Serialize(Root, Writer);

    TSharedRef<IHttpRequest> Request = FHttpModule::Get().CreateRequest();
    Request->SetURL(ApiBaseUrl + TEXT("/api/the-door/xr/interactions"));
    Request->SetVerb(TEXT("POST"));
    Request->SetHeader(TEXT("Content-Type"), TEXT("application/json"));

    if (!BearerToken.IsEmpty())
    {
        Request->SetHeader(TEXT("Authorization"), TEXT("Bearer ") + BearerToken);
    }

    Request->SetContentAsString(Body);
    Request->OnProcessRequestComplete().BindUObject(
        this,
        &UDoorXRSubsystem::HandleResponse,
        Interaction
    );
    Request->ProcessRequest();
}

void UDoorXRSubsystem::HandleResponse(
    FHttpRequestPtr Request,
    FHttpResponsePtr Response,
    bool bWasSuccessful,
    FDoorXRInteraction OriginalInteraction)
{
    if (!bWasSuccessful || !Response.IsValid())
    {
        OnRequestFailed.Broadcast(TEXT("THE DOOR XR backend request failed."));
        return;
    }

    if (Response->GetResponseCode() < 200 || Response->GetResponseCode() >= 300)
    {
        OnRequestFailed.Broadcast(
            FString::Printf(
                TEXT("THE DOOR XR backend returned HTTP %d."),
                Response->GetResponseCode()
            )
        );
        return;
    }

    TSharedPtr<FJsonObject> Json;
    const TSharedRef<TJsonReader<>> Reader =
        TJsonReaderFactory<>::Create(Response->GetContentAsString());

    if (!FJsonSerializer::Deserialize(Reader, Json) || !Json.IsValid())
    {
        OnRequestFailed.Broadcast(TEXT("THE DOOR XR backend returned invalid JSON."));
        return;
    }

    FDoorXRInteractionResult Result;
    Result.bAccepted = Json->GetBoolField(TEXT("accepted"));
    Result.bAuthoritative = Json->GetBoolField(TEXT("authoritative"));
    Result.NextStep = Json->GetStringField(TEXT("next_step"));
    Json->TryGetStringField(TEXT("reason"), Result.Reason);
    Json->TryGetStringField(TEXT("target_id"), Result.TargetId);

    OnInteractionNormalized.Broadcast(Result);

    // Critical invariant: backend normalization is not realm-entry permission.
    // The game's existing authoritative Door-entry function (for example,
    // TryEnterRetroDoor) must be invoked by the gameplay layer bound here.
    if (Result.bAccepted
        && !Result.bAuthoritative
        && Result.NextStep == TEXT("authorize_in_game"))
    {
        OnDoorAuthorizationRequired.Broadcast(OriginalInteraction, Result);
    }
}
