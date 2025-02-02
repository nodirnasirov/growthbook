import { UseFormReturn } from "react-hook-form";
import React, { useEffect, useState } from "react";
import {
  FaExclamationCircle,
  FaExternalLinkAlt,
  FaInfoCircle,
  FaQuestionCircle,
} from "react-icons/fa";
import { FaGear } from "react-icons/fa6";
import { getConnectionsSDKCapabilities } from "shared/dist/sdk-versioning";
import useOrgSettings from "@/hooks/useOrgSettings";
import { useAttributeSchema } from "@/services/features";
import PremiumTooltip from "@/components/Marketing/PremiumTooltip";
import usePermissions from "@/hooks/usePermissions";
import { useUser } from "@/services/UserContext";
import { useAuth } from "@/services/auth";
import useSDKConnections from "@/hooks/useSDKConnections";
import { DocLink } from "@/components/DocLink";
import SelectField from "../Forms/SelectField";
import Toggle from "../Forms/Toggle";

export interface Props {
  // eslint-disable-next-line
  form: UseFormReturn<any>;
}

export default function FallbackAttributeSelector({ form }: Props) {
  const [showSBInformation, setShowSBInformation] = useState(false);

  const { apiCall } = useAuth();
  const { refreshOrganization, hasCommercialFeature } = useUser();

  const permissions = usePermissions();
  const settings = useOrgSettings();
  const orgStickyBucketing = settings.useStickyBucketing;
  const orgFallbackAttribute = settings.useFallbackAttributes;
  const hasStickyBucketFeature = hasCommercialFeature("sticky-bucketing");

  const { data: sdkConnectionsData } = useSDKConnections();
  const hasSDKWithStickyBucketing = getConnectionsSDKCapabilities(
    sdkConnectionsData?.connections || []
  ).includes("stickyBucketing");

  const attributeSchema = useAttributeSchema();
  const hasHashAttributes =
    attributeSchema.filter((x) => x.hashAttribute).length > 0;

  const hashAttribute = form.watch("hashAttribute");
  const fallbackAttribute = form.watch("fallbackAttribute");
  useEffect(() => {
    if (hashAttribute && hashAttribute === fallbackAttribute) {
      form.setValue("fallbackAttribute", "");
    }
  }, [hashAttribute, fallbackAttribute, form]);

  const setOrgStickyBucketingToggle = async (v: boolean) => {
    await apiCall(`/organization`, {
      method: "PUT",
      body: JSON.stringify({
        settings: {
          useStickyBucketing: v,
        },
      }),
    });
    await refreshOrganization();
  };

  if (!orgFallbackAttribute) {
    return null;
  }

  return (
    <SelectField
      containerClassName="flex-1"
      label="Fallback attribute"
      labelClassName="font-weight-bold"
      options={[
        { label: "none", value: "" },
        ...attributeSchema
          .filter((s) => !hasHashAttributes || s.hashAttribute)
          .filter((s) => s.property !== form.watch("hashAttribute"))
          .map((s) => ({ label: s.property, value: s.property })),
      ]}
      formatOptionLabel={({ value, label }) => {
        if (!value) {
          return <em className="text-muted">{label}</em>;
        }
        return label;
      }}
      sort={false}
      value={orgStickyBucketing ? form.watch("fallbackAttribute") || "" : ""}
      onChange={(v) => {
        form.setValue("fallbackAttribute", v);
      }}
      helpText={
        <>
          <div>
            If the user&apos;s assignment attribute is not available the
            fallback attribute may be used instead.
          </div>
          {/* todo: so long as `settings.useFallbackAttributes` gates this field, we should never see these embedded controls. Keeping them here for now in case we stop gating this field.*/}
          {(!orgStickyBucketing || showSBInformation) && (
            <div className="d-flex mt-1">
              <div className="text-warning-orange">
                <FaInfoCircle /> Requires Sticky Bucketing
              </div>
              <div className="flex-1" />
              {!showSBInformation ? (
                <>
                  {!orgStickyBucketing && <span>(disabled by org)</span>}
                  {permissions.organizationSettings && (
                    <a
                      role="button"
                      className="a ml-2"
                      onClick={() => setShowSBInformation(true)}
                    >
                      <FaGear size={13} />
                    </a>
                  )}
                </>
              ) : (
                <>
                  {hasSDKWithStickyBucketing && (
                    <div
                      className="position-relative"
                      style={{ top: 1, maxWidth: 180 }}
                    >
                      <div className="d-flex align-items-center justify-content-end">
                        <PremiumTooltip
                          commercialFeature={"sticky-bucketing"}
                          usePortal={true}
                          className="text-right"
                          innerClassName="text-left"
                          body={<StickyBucketingTooltip />}
                        >
                          <div
                            className="d-inline-block"
                            style={{ lineHeight: "14px" }}
                          >
                            Enable Sticky Bucketing for org <FaQuestionCircle />
                          </div>
                        </PremiumTooltip>
                        <Toggle
                          id="orgStickyBucketingToggle"
                          value={!!orgStickyBucketing}
                          setValue={setOrgStickyBucketingToggle}
                          disabled={
                            !hasStickyBucketFeature ||
                            !hasSDKWithStickyBucketing
                          }
                          className="ml-2"
                          style={{ width: 70 }}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          {showSBInformation && (
            <StickyBucketingToggleWarning
              hasSDKWithStickyBucketing={hasSDKWithStickyBucketing}
              showIcon={false}
            />
          )}
        </>
      }
      disabled={!orgStickyBucketing}
    />
  );
}

export function StickyBucketingTooltip() {
  return (
    <>
      <div className="mb-2">
        Sticky Bucketing prevents users from flipping between variations when
        you make changes to a running experiment. It does this by persisting the
        first variation each user is exposed to.
      </div>

      <div className="mb-2">
        Sticky Bucketing requires changes to your SDK implementation and is only
        supported in the following SDKs and versions:
        <ul className="mb-1">
          <li>Javascript &gt;= 0.32.0</li>
          <li>React &gt;= 0.22.0</li>
        </ul>
      </div>
    </>
  );
}

export function StickyBucketingToggleWarning({
  hasSDKWithStickyBucketing,
  showIcon = true,
}: {
  hasSDKWithStickyBucketing: boolean;
  showIcon?: boolean;
}) {
  return (
    <>
      {!hasSDKWithStickyBucketing ? (
        <div className="mt-1 mb-1 text-warning-orange">
          {showIcon && <FaExclamationCircle className="mr-1" />}
          At least one SDK Connection with a compatible SDK is required to use
          Sticky Bucketing.
          <DocLink
            docSection="stickyBucketing"
            className="align-self-center d-block mt-1"
          >
            Sticky Bucketing Documentation <FaExternalLinkAlt />
          </DocLink>
        </div>
      ) : (
        <div className="mt-1 mb-2 text-muted">
          <div>
            {showIcon && <FaExclamationCircle className="mr-1" />}
            Ensure that Sticky Bucketing is correctly integrated with your SDK
            in your app codebase before using.
          </div>
          <DocLink
            docSection="stickyBucketing"
            className="align-self-center d-block mt-1"
          >
            Sticky Bucketing Documentation <FaExternalLinkAlt />
          </DocLink>
        </div>
      )}
    </>
  );
}
