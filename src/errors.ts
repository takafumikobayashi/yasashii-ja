/** 利用者に見せる日本語メッセージ付きのエラー。 */
export class UserError extends Error {
  readonly exitCode: number;
  constructor(message: string, exitCode = 1) {
    super(message);
    this.name = "UserError";
    this.exitCode = exitCode;
  }
}

/** 利用者の確認が必要なため処理を止めたことを示す終了コード。 */
export const EXIT_NEEDS_CONFIRMATION = 2;
