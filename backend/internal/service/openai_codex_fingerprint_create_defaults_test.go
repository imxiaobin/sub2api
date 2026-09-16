package service

import (
	"testing"

	"github.com/stretchr/testify/require"
)

// klno：新建 / 导入的 OpenAI OAuth 类账号缺省开启 device 收敛 + 实验性指纹收敛。
// 所有创建入口（新建表单、auth.json / AT 批量导入、OAuth 授权、Codex PAT）都经过
// prepareCodexFingerprintExtraForCreate，因此这里覆盖它就覆盖了全部入口。
func TestPrepareCodexFingerprintExtraForCreateAppliesKlnoDefaults(t *testing.T) {
	for _, accountType := range []string{AccountTypeOAuth, AccountTypeSetupToken} {
		t.Run(accountType, func(t *testing.T) {
			prepared := prepareCodexFingerprintExtraForCreate(PlatformOpenAI, accountType, nil)

			require.Equal(t, string(codexFingerprintDevice), prepared[codexFingerprintModeExtraKey])
			require.Equal(t, true, prepared[codexFingerprintConvergenceExtraKey])
			// device 档位需要种子，创建期必须一并铸出。
			requireValidCodexFingerprintSeed(t, prepared)
		})
	}
}

// 显式传入的配置一律尊重，包括显式关闭——否则管理员在新建弹窗里取消的勾选
// 会被创建期默认重新打开。
func TestPrepareCodexFingerprintExtraForCreateRespectsExplicitOff(t *testing.T) {
	prepared := prepareCodexFingerprintExtraForCreate(PlatformOpenAI, AccountTypeOAuth, map[string]any{
		codexFingerprintModeExtraKey:        string(codexFingerprintOff),
		codexFingerprintConvergenceExtraKey: false,
	})

	require.Equal(t, string(codexFingerprintOff), prepared[codexFingerprintModeExtraKey])
	require.Equal(t, false, prepared[codexFingerprintConvergenceExtraKey])
	// off 不需要种子。
	require.NotContains(t, prepared, codexFingerprintSeedExtraKey)
}

func TestPrepareCodexFingerprintExtraForCreateRespectsExplicitNonDefaultMode(t *testing.T) {
	prepared := prepareCodexFingerprintExtraForCreate(PlatformOpenAI, AccountTypeOAuth, map[string]any{
		codexFingerprintModeExtraKey: string(codexFingerprintFull),
	})

	require.Equal(t, string(codexFingerprintFull), prepared[codexFingerprintModeExtraKey])
	// 只补缺失的那一项。
	require.Equal(t, true, prepared[codexFingerprintConvergenceExtraKey])
	requireValidCodexFingerprintSeed(t, prepared)
}

// 非 OpenAI OAuth 类账号不该被写入这两个键。
func TestPrepareCodexFingerprintExtraForCreateSkipsIneligibleAccounts(t *testing.T) {
	cases := []struct {
		name        string
		platform    string
		accountType string
	}{
		{"openai-apikey", PlatformOpenAI, AccountTypeAPIKey},
		{"anthropic-oauth", PlatformAnthropic, AccountTypeOAuth},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			require.Nil(t, prepareCodexFingerprintExtraForCreate(tc.platform, tc.accountType, nil))

			prepared := prepareCodexFingerprintExtraForCreate(tc.platform, tc.accountType, map[string]any{"foo": "bar"})
			require.NotContains(t, prepared, codexFingerprintModeExtraKey)
			require.NotContains(t, prepared, codexFingerprintConvergenceExtraKey)
		})
	}
}

// 创建期默认不得改写调用方传入的 map（prepareCodexFingerprintExtraForCreate 会先克隆）。
func TestPrepareCodexFingerprintExtraForCreateDoesNotMutateInput(t *testing.T) {
	input := map[string]any{"foo": "bar"}
	prepared := prepareCodexFingerprintExtraForCreate(PlatformOpenAI, AccountTypeOAuth, input)

	require.Equal(t, map[string]any{"foo": "bar"}, input)
	require.Equal(t, string(codexFingerprintDevice), prepared[codexFingerprintModeExtraKey])
}

// 端到端：管理端创建路径（所有导入入口共用）落库的账号带上默认配置。
func TestAdminCreateAccountAppliesKlnoFingerprintDefaults(t *testing.T) {
	repo := &upstreamBillingProbeAccountRepo{}
	svc := &adminServiceImpl{accountRepo: repo}

	created, err := svc.CreateAccount(t.Context(), &CreateAccountInput{
		Name:                 "codex-import",
		Platform:             PlatformOpenAI,
		Type:                 AccountTypeOAuth,
		SkipDefaultGroupBind: true,
	})

	require.NoError(t, err)
	require.Equal(t, string(codexFingerprintDevice), created.Extra[codexFingerprintModeExtraKey])
	require.Equal(t, true, created.Extra[codexFingerprintConvergenceExtraKey])
	requireValidCodexFingerprintSeed(t, created.Extra)
	require.True(t, codexFingerprintConvergenceEnabled(created))
	require.Equal(t, codexFingerprintDevice, created.GetCodexFingerprintMode())
}
